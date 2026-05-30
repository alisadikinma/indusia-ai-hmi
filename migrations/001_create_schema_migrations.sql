-- Schema migrations tracking table
-- This table records which SQL migrations have been applied to this database.
-- The migration runner checks this table to determine which migrations are pending.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  filename TEXT NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  applied_by TEXT
);
