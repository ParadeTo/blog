-- schema.sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS memories (
    id              TEXT        PRIMARY KEY,
    session_id      TEXT        NOT NULL,
    routing_key     TEXT        NOT NULL,

    user_message    TEXT        NOT NULL,
    assistant_reply TEXT        NOT NULL,

    summary         TEXT        NOT NULL,
    tags            TEXT[]      NOT NULL DEFAULT '{}',

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    turn_ts         BIGINT      NOT NULL,

    summary_vec     vector(1536),
    message_vec     vector(1536),

    search_text     TEXT        NOT NULL DEFAULT '',
    search_tsv      TSVECTOR    GENERATED ALWAYS AS (to_tsvector('simple', search_text)) STORED
);

CREATE INDEX IF NOT EXISTS memories_summary_vec_idx
    ON memories USING hnsw (summary_vec vector_cosine_ops);

CREATE INDEX IF NOT EXISTS memories_search_tsv_idx
    ON memories USING gin (search_tsv);

CREATE INDEX IF NOT EXISTS memories_routing_key_idx ON memories (routing_key);
CREATE INDEX IF NOT EXISTS memories_created_at_idx  ON memories (created_at DESC);
CREATE INDEX IF NOT EXISTS memories_tags_idx        ON memories USING gin (tags);
