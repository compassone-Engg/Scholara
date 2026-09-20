-- Phase 2 (chatbot): rate-limit ledger + per-turn telemetry.
-- Both keyed by pseudonymous_id. No PII stored.

-- One row per (pseudonymous_id, day) with running message count.
-- Used by /api/chat to enforce a daily cap before invoking the LLM.
CREATE TABLE IF NOT EXISTS chat_rate_limit (
  pseudonymous_id  TEXT NOT NULL,
  day              TEXT NOT NULL,        -- 'YYYY-MM-DD' UTC
  message_count    INTEGER NOT NULL DEFAULT 0,
  last_message_ts  INTEGER NOT NULL,
  PRIMARY KEY (pseudonymous_id, day)
);

CREATE INDEX IF NOT EXISTS idx_rate_day ON chat_rate_limit(day);

-- One row per chat turn. payload is JSON metadata (never the message body itself).
CREATE TABLE IF NOT EXISTS chat_turns (
  id                TEXT PRIMARY KEY,
  pseudonymous_id   TEXT NOT NULL,
  conversation_id   TEXT NOT NULL,
  role              TEXT NOT NULL,        -- 'user' | 'assistant' | 'tool' | 'system'
  model             TEXT,                 -- e.g. 'gemini-2.5-flash'
  provider          TEXT,                 -- 'gemini' | 'claude'
  input_tokens      INTEGER,
  output_tokens     INTEGER,
  tool_calls_json   TEXT,                 -- JSON array of {tool, args} (no result body)
  duration_ms       INTEGER,
  app_version       TEXT,
  client_timestamp  INTEGER,
  server_timestamp  INTEGER NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000)
);

CREATE INDEX IF NOT EXISTS idx_turns_pseudo  ON chat_turns(pseudonymous_id);
CREATE INDEX IF NOT EXISTS idx_turns_convo   ON chat_turns(conversation_id);
CREATE INDEX IF NOT EXISTS idx_turns_time    ON chat_turns(server_timestamp);
