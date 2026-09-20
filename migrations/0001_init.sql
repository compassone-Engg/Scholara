-- Phase 1: anonymized event collection.
-- All rows are keyed by pseudonymous_id (UUID generated client-side, stored in
-- the user's localStorage). No PII is written to this table — see
-- app/lib/events.ts for the client-side payload shape.

CREATE TABLE IF NOT EXISTS student_events (
  id                TEXT PRIMARY KEY,
  pseudonymous_id   TEXT NOT NULL,
  event_type        TEXT NOT NULL,
  payload           TEXT,
  app_version       TEXT,
  client_timestamp  INTEGER,
  server_timestamp  INTEGER NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000)
);

CREATE INDEX IF NOT EXISTS idx_events_pseudo ON student_events(pseudonymous_id);
CREATE INDEX IF NOT EXISTS idx_events_type   ON student_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_time   ON student_events(server_timestamp);
