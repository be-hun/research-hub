import json

import psycopg
import pytest

from app.db import _TABLES, init_schema
from app.main import create_app

CONVERSATION_TABLES = {"conversations", "conversation_messages"}


def _app_db():
    return create_app().state.db


def _add_conversation(conn, cid="c-1"):
    conn.execute("INSERT INTO conversations (id, owner, title) VALUES (?, ?, ?)", (cid, "demo", "Cancer labs"))
    conn.execute(
        "INSERT INTO conversation_messages (conversation_id, position, role, text) VALUES (?, 0, 'user', ?)",
        (cid, "Who studies cancer metabolism?"))
    conn.execute(
        "INSERT INTO conversation_messages (conversation_id, position, role, text, reply) "
        "VALUES (?, 1, 'assistant', ?, ?::jsonb)",
        (cid, "Here are three labs.", json.dumps({"text": "Here are three labs."})))


def test_tables_exist_after_startup_and_are_secured():
    conn = _app_db()
    rows = conn.execute(
        "SELECT relname, relrowsecurity FROM pg_class WHERE relnamespace = current_schema()::regnamespace "
        "AND relkind = 'r'").fetchall()
    secured = {r[0] for r in rows if r[1]}
    assert CONVERSATION_TABLES <= secured
    assert not CONVERSATION_TABLES & set(_TABLES)  # init_schema never drops them


def test_conversations_survive_a_schema_rebuild():
    conn = _app_db()
    _add_conversation(conn)
    conn.execute("UPDATE schema_meta SET version = 0")
    init_schema(conn)
    assert conn.execute("SELECT version FROM schema_meta").fetchone()[0] > 0  # the rebuild did run
    assert conn.execute("SELECT title FROM conversations WHERE id = 'c-1'").fetchone()[0] == "Cancer labs"
    assert conn.execute("SELECT count(*) FROM conversation_messages WHERE conversation_id = 'c-1'").fetchone()[0] == 2


def test_deleting_a_conversation_deletes_its_messages():
    conn = _app_db()
    _add_conversation(conn)
    conn.execute("DELETE FROM conversations WHERE id = 'c-1'")
    assert conn.execute("SELECT count(*) FROM conversation_messages").fetchone()[0] == 0


def test_only_user_and_assistant_roles_are_allowed():
    conn = _app_db()
    conn.execute("INSERT INTO conversations (id, owner, title) VALUES ('c-2', 'demo', 'x')")
    with pytest.raises(psycopg.errors.CheckViolation):
        conn.execute(
            "INSERT INTO conversation_messages (conversation_id, position, role, text) VALUES ('c-2', 0, 'system', 'x')")


def test_startup_twice_keeps_existing_rows():
    conn = _app_db()
    _add_conversation(conn)
    create_app()
    assert conn.execute("SELECT count(*) FROM conversations").fetchone()[0] == 1
