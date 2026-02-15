-- OTA Update log table
-- Records each system update attempt with status, timing, and output.

CREATE TABLE IF NOT EXISTS update_log (
  id SERIAL PRIMARY KEY,
  from_version TEXT NOT NULL,
  to_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress',
  triggered_by TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  migrations_applied INTEGER DEFAULT 0,
  commits_pulled INTEGER DEFAULT 0,
  error_message TEXT,
  log_output TEXT
);
