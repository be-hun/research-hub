"""Postgres access. Production uses Supabase; development and tests use any Postgres 15+.

The query modules were written against sqlite3, so `Connection` keeps that interface: `execute(sql, params)` with
`?` placeholders, rows readable by position or column name, and `with conn:` for one transaction.
"""

import logging
import queue
import re
import threading
import time
from contextlib import contextmanager
from pathlib import Path

import psycopg
from psycopg import pq
from psycopg.types.numeric import NumericLoader

from app import config

SCHEMA = Path(__file__).with_name("schema.sql")
SCHEMA_VERSION = 6  # bump when schema.sql changes; older databases are rebuilt by the next import
_INIT_LOCK = 7_041_955  # advisory lock id, so two app workers starting at once don't both build the schema
_TABLES = re.findall(r"CREATE TABLE IF NOT EXISTS (\w+)", SCHEMA.read_text())
# A quoted string (kept as is), a ? placeholder, or a literal % (escaped because psycopg formats with %s).
_SQL_TOKEN = re.compile(r"'(?:[^']|'')*'|\?|%")
# Pooled connections idle longer than this are checked before use; Supabase's pooler drops idle clients.
_STALE_SECONDS = 60
log = logging.getLogger(__name__)


class Row(tuple):
    """A result row readable by position or by column name, like sqlite3.Row."""

    def __new__(cls, values, index: dict[str, int]):
        row = super().__new__(cls, values)
        row._index = index
        return row

    def __getitem__(self, key):
        if isinstance(key, str):
            return tuple.__getitem__(self, self._index[key])
        return tuple.__getitem__(self, key)

    def keys(self) -> list[str]:
        return list(self._index)


def _row_factory(cursor):
    index: dict[str, int] = {}
    for i, column in enumerate(cursor.description or ()):
        index.setdefault(column.name, i)  # like sqlite3.Row, a repeated name reads the first column
    return lambda values: Row(values, index)


class _NumberLoader(NumericLoader):
    """SUM over BIGINT returns NUMERIC; give whole numbers back as int so models and f-strings see plain numbers."""

    def load(self, data):
        value = super().load(data)
        if value.is_finite():
            return int(value) if value == value.to_integral_value() else float(value)
        return float(value)


def _pg(sql: str) -> str:
    return _SQL_TOKEN.sub(lambda m: "%s" if m.group() == "?" else "%%" if m.group() == "%" else m.group(), sql)


class Connection:
    """One Postgres connection in autocommit mode; `with conn:` wraps a block in a transaction."""

    def __init__(self, raw: psycopg.Connection):
        self.raw = raw
        self.last_used = time.monotonic()
        self._transactions: list = []

    def execute(self, sql: str, params=None) -> psycopg.Cursor:
        if params is None:
            return self.raw.execute(sql)  # no parameters: sent as is, and may hold several statements
        return self.raw.execute(_pg(sql), params)

    def executemany(self, sql: str, rows) -> None:
        with self.raw.cursor() as cur:
            cur.executemany(_pg(sql), rows)

    def copy_rows(self, table: str, columns: list[str], rows) -> None:
        """Bulk insert with COPY, much faster than INSERTs over the network to Supabase."""
        with self.raw.cursor() as cur:
            with cur.copy(f"COPY {table} ({', '.join(columns)}) FROM STDIN") as copy:
                for row in rows:
                    copy.write_row(row)

    def commit(self) -> None:
        """Statements outside `with conn:` are already committed; kept for sqlite3-style callers."""

    def close(self) -> None:
        self.raw.close()

    def __enter__(self) -> "Connection":
        tx = self.raw.transaction()
        tx.__enter__()
        self._transactions.append(tx)
        return self

    def __exit__(self, *exc) -> None:
        self._transactions.pop().__exit__(*exc)


def connect(url: str | None = None) -> Connection:
    url = url or config.DATABASE_URL
    if not url:
        raise RuntimeError("DATABASE_URL is not set. Copy backend/.env.example to backend/.env and fill it in.")
    # prepare_threshold=None: no server-side prepared statements, which Supabase's transaction pooler rejects.
    raw = psycopg.connect(url, autocommit=True, row_factory=_row_factory, prepare_threshold=None, connect_timeout=10)
    raw.adapters.register_loader("numeric", _NumberLoader)
    return Connection(raw)


class Pool:
    """A few reusable connections for request threads. Supabase's pooler caps connections per client."""

    def __init__(self, url: str | None, size: int):
        self.url = url
        self._idle: queue.LifoQueue[Connection] = queue.LifoQueue()
        self._slots = threading.BoundedSemaphore(size)

    def _checkout(self) -> Connection:
        while True:
            try:
                conn = self._idle.get_nowait()
            except queue.Empty:
                return connect(self.url)
            if time.monotonic() - conn.last_used < _STALE_SECONDS:
                return conn
            try:
                conn.execute("SELECT 1")
                return conn
            except psycopg.Error:
                conn.close()

    @contextmanager
    def connection(self):
        with self._slots:
            conn = self._checkout()
            try:
                yield conn
            finally:
                healthy = not conn.raw.closed and conn.raw.info.transaction_status == pq.TransactionStatus.IDLE
                if healthy:
                    conn.last_used = time.monotonic()
                    self._idle.put(conn)
                else:
                    conn.close()

    def close(self) -> None:
        while True:
            try:
                self._idle.get_nowait().close()
            except queue.Empty:
                return


def init_schema(conn: Connection) -> None:
    """Create the tables, or rebuild them when SCHEMA_VERSION is newer than the database's."""
    with conn:
        conn.execute("SELECT pg_advisory_xact_lock(?)", (_INIT_LOCK,))
        conn.execute("CREATE TABLE IF NOT EXISTS schema_meta (version INTEGER NOT NULL)")
        conn.execute("ALTER TABLE schema_meta ENABLE ROW LEVEL SECURITY")  # see the end of schema.sql
        row = conn.execute("SELECT version FROM schema_meta").fetchone()
        if row and row[0] >= SCHEMA_VERSION:
            return
        # Every table is rebuilt from the cached raw data by ingest.run, so dropping is safe.
        # Only this app's own tables are dropped, never anything else in the schema.
        for name in _TABLES:
            conn.execute(f'DROP TABLE IF EXISTS "{name}" CASCADE')
        conn.execute(SCHEMA.read_text())
        conn.execute("DELETE FROM schema_meta")
        conn.execute("INSERT INTO schema_meta (version) VALUES (?)", (SCHEMA_VERSION,))


def ensure_search_extensions(conn: Connection) -> bool:
    """Install pg_trgm and a trigram index on researcher names, for fuzzy people search. True when usable.

    Optional: people search works without it (word-prefix matching only). Not in schema.sql, because a schema change
    rebuilds every table. On Supabase the extension may land in the `extensions` schema, which is on the search path.
    """
    try:
        conn.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_researchers_name_trgm ON researchers USING gin (name gin_trgm_ops)")
    except psycopg.Error as exc:
        log.warning("pg_trgm is unavailable, so people search won't match misspelled names: %s", exc)
        return False
    return has_trigrams(conn)


def has_trigrams(conn: Connection) -> bool:
    """Whether pg_trgm's word_similarity() is on this connection's search path."""
    return bool(conn.execute("SELECT to_regprocedure('word_similarity(text,text)') IS NOT NULL").fetchone()[0])
