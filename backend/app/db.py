import sqlite3
from pathlib import Path

SCHEMA = Path(__file__).with_name("schema.sql")
SCHEMA_VERSION = 4  # bump when schema.sql changes; older databases are rebuilt by the next import


def connect(path: Path | str) -> sqlite3.Connection:
    if str(path) != ":memory:":
        Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 5000")
    if str(path) != ":memory:":
        conn.execute("PRAGMA journal_mode = WAL")
    return conn


def init_schema(conn: sqlite3.Connection) -> None:
    version = conn.execute("PRAGMA user_version").fetchone()[0]
    has_tables = conn.execute("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table'").fetchone()[0]
    if has_tables and version < SCHEMA_VERSION:
        # Every table is rebuilt from the cached raw data by ingest.run, so dropping is safe.
        names = [r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%fts_%'")]
        conn.execute("PRAGMA foreign_keys = OFF")
        for name in names:
            conn.execute(f'DROP TABLE IF EXISTS "{name}"')
        conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(SCHEMA.read_text())
    conn.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
