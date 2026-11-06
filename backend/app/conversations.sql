-- Saved Ask conversations. Kept out of schema.sql on purpose: init_schema drops and rebuilds every table in
-- schema.sql when SCHEMA_VERSION changes, and ingest rebuilds the data. These rows are user work and must survive
-- both, so this file only ever creates what is missing (db.ensure_conversation_tables runs it at startup).

CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,  -- a uuid4 string made by the app
    owner TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_owner_updated ON conversations(owner, updated_at DESC);

CREATE TABLE IF NOT EXISTS conversation_messages (
    id BIGSERIAL PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    text TEXT NOT NULL,
    reply JSONB,  -- the full AssistantReply JSON for assistant turns, NULL for user turns
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (conversation_id, position)
);

-- Supabase serves tables in the public schema through its Data API to anyone with the project's anon key.
-- Row level security with no policies closes that path; the backend connects as the table owner, which RLS
-- doesn't apply to. On plain Postgres this changes nothing.
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
