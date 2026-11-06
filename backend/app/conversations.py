"""Saved Ask conversations. Every query filters by owner, the client id from the X-Client-Id header.

The tables are created by db.ensure_conversation_tables (conversations.sql). The owner is demo-grade identity: a
browser-kept id, not an account, so conversations are private by obscurity only.
"""

import re
import uuid

from psycopg.types.json import Jsonb
from pydantic import ValidationError

from app import models
from app.db import Connection, Row

CLIENT_ID = re.compile(r"[A-Za-z0-9-]{8,64}")
TITLE_LENGTH = 80
LIST_LIMIT = 50
SUMMARY_SQL = """
    SELECT c.id, c.title, c.created_at, c.updated_at, COUNT(m.id) AS message_count
    FROM conversations c LEFT JOIN conversation_messages m ON m.conversation_id = c.id
    WHERE c.owner = ? {where}
    GROUP BY c.id, c.title, c.created_at, c.updated_at
"""


def valid_client_id(value: str | None) -> bool:
    return value is not None and CLIENT_ID.fullmatch(value) is not None


def title_for(question: str) -> str:
    """The question on one line, cut to 80 characters at a word boundary."""
    text = " ".join(question.split())
    if len(text) <= TITLE_LENGTH:
        return text or "New conversation"
    cut = text[:TITLE_LENGTH + 1]
    cut = cut.rsplit(" ", 1)[0] if " " in cut else cut
    return cut[:TITLE_LENGTH].rstrip(" ,;:-")


def _summary(r: Row) -> models.ConversationSummary:
    return models.ConversationSummary(id=r["id"], title=r["title"], createdAt=r["created_at"].isoformat(),
                                      updatedAt=r["updated_at"].isoformat(), messageCount=r["message_count"])


def exists(conn: Connection, owner: str, conversation_id: str) -> bool:
    return conn.execute("SELECT 1 FROM conversations WHERE id = ? AND owner = ?",
                        (conversation_id, owner)).fetchone() is not None


def save_turn(conn: Connection, owner: str, conversation_id: str | None, question: str,
              reply: models.AssistantReply) -> str | None:
    """Store a question and its answer, starting a conversation when there's no id. None if the id isn't the owner's."""
    with conn:
        if conversation_id is None:
            conversation_id = str(uuid.uuid4())
            conn.execute("INSERT INTO conversations (id, owner, title, created_at, updated_at) "
                         "VALUES (?, ?, ?, now(), now())", (conversation_id, owner, title_for(question)))
            position = 0
        else:
            row = conn.execute("SELECT 1 FROM conversations WHERE id = ? AND owner = ? FOR UPDATE",
                               (conversation_id, owner)).fetchone()
            if row is None:
                return None
            conn.execute("UPDATE conversations SET updated_at = now() WHERE id = ?", (conversation_id,))
            position = conn.execute("SELECT COALESCE(MAX(position) + 1, 0) FROM conversation_messages "
                                    "WHERE conversation_id = ?", (conversation_id,)).fetchone()[0]
        stored = reply.model_copy(update={"conversationId": conversation_id}).model_dump(mode="json", by_alias=True)
        conn.executemany(
            "INSERT INTO conversation_messages (conversation_id, position, role, text, reply, created_at) "
            "VALUES (?, ?, ?, ?, ?, now())",
            [(conversation_id, position, "user", question, None),
             (conversation_id, position + 1, "assistant", reply.summary, Jsonb(stored))],
        )
    return conversation_id


def list_for(conn: Connection, owner: str) -> models.ConversationList:
    rows = conn.execute(SUMMARY_SQL.format(where="") + " ORDER BY c.updated_at DESC, c.id LIMIT ?",
                        (owner, LIST_LIMIT)).fetchall()
    return models.ConversationList(conversations=[_summary(r) for r in rows])


def summary(conn: Connection, owner: str, conversation_id: str) -> models.ConversationSummary | None:
    row = conn.execute(SUMMARY_SQL.format(where="AND c.id = ?"), (owner, conversation_id)).fetchone()
    return _summary(row) if row else None


def _reply(value) -> models.AssistantReply | None:
    if value is None:
        return None
    try:
        return models.AssistantReply.model_validate(value)
    except ValidationError:  # saved under an older contract: show the text without the cards
        return None


def get(conn: Connection, owner: str, conversation_id: str) -> models.Conversation | None:
    head = conn.execute("SELECT id, title, created_at, updated_at FROM conversations WHERE id = ? AND owner = ?",
                        (conversation_id, owner)).fetchone()
    if head is None:
        return None
    rows = conn.execute("SELECT role, text, reply, created_at FROM conversation_messages "
                        "WHERE conversation_id = ? ORDER BY position", (conversation_id,)).fetchall()
    messages = [models.ConversationMessage(role=r["role"], text=r["text"], reply=_reply(r["reply"]),
                                           createdAt=r["created_at"].isoformat()) for r in rows]
    return models.Conversation(id=head["id"], title=head["title"], createdAt=head["created_at"].isoformat(),
                               updatedAt=head["updated_at"].isoformat(), messages=messages)


def rename(conn: Connection, owner: str, conversation_id: str, title: str) -> models.ConversationSummary | None:
    updated = conn.execute("UPDATE conversations SET title = ? WHERE id = ? AND owner = ?",
                           (title, conversation_id, owner)).rowcount
    return summary(conn, owner, conversation_id) if updated else None


def delete(conn: Connection, owner: str, conversation_id: str) -> bool:
    """Messages go with it (ON DELETE CASCADE)."""
    return conn.execute("DELETE FROM conversations WHERE id = ? AND owner = ?",
                        (conversation_id, owner)).rowcount > 0
