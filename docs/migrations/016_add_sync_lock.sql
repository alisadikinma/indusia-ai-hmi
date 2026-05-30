-- ============================================================================
-- Migration 016: Add Sync Lock Table
-- ============================================================================

-- 1. Create sync_lock table to prevent concurrent syncs
CREATE TABLE IF NOT EXISTS sync_lock (
    id INTEGER PRIMARY KEY DEFAULT 1,
    locked_by VARCHAR(100),
    locked_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    sync_type VARCHAR(20),
    progress_current INTEGER DEFAULT 0,
    progress_total INTEGER DEFAULT 0,
    current_table VARCHAR(50),
    CONSTRAINT single_row CHECK (id = 1)
);

-- Initialize with empty lock
INSERT INTO sync_lock (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 2. Add columns to cloud_sync_state if not exists
ALTER TABLE cloud_sync_state ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE cloud_sync_state ADD COLUMN IF NOT EXISTS last_success_count INTEGER DEFAULT 0;
ALTER TABLE cloud_sync_state ADD COLUMN IF NOT EXISTS last_failed_count INTEGER DEFAULT 0;

-- 3. Create indexes for faster pending records query
CREATE INDEX IF NOT EXISTS idx_inspection_results_sync_pending
ON inspection_results(sync_status, created_at)
WHERE sync_status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_overrides_sync_pending
ON overrides(sync_status, created_at)
WHERE sync_status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_event_log_sync_pending
ON event_log(sync_status, created_at)
WHERE sync_status IN ('pending', 'failed');

-- 4. Verify
SELECT 'sync_lock created' as status, COUNT(*) as rows FROM sync_lock;
