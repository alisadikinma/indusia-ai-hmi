-- ============================================================================
-- INDUSIA AI HMI - Sync Lock Migration
-- ============================================================================
-- Run this on LOCAL PostgreSQL (indusia_db) via pgAdmin
-- ============================================================================

-- 1. Create sync_lock table to prevent concurrent syncs
CREATE TABLE IF NOT EXISTS sync_lock (
    id INTEGER PRIMARY KEY DEFAULT 1,
    locked_by VARCHAR(100),           -- PC name / hostname
    locked_at TIMESTAMPTZ,            -- When lock was acquired
    expires_at TIMESTAMPTZ,           -- Auto-release after this time
    sync_type VARCHAR(20),            -- 'to_cloud' or 'from_cloud'
    progress_current INTEGER DEFAULT 0,
    progress_total INTEGER DEFAULT 0,
    current_table VARCHAR(50),
    CONSTRAINT single_row CHECK (id = 1)
);

-- Initialize with empty lock
INSERT INTO sync_lock (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 2. Update cloud_sync_state with additional columns
ALTER TABLE cloud_sync_state ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE cloud_sync_state ADD COLUMN IF NOT EXISTS last_success_count INTEGER DEFAULT 0;
ALTER TABLE cloud_sync_state ADD COLUMN IF NOT EXISTS last_failed_count INTEGER DEFAULT 0;

-- 3. Create index for faster pending records query
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
SELECT 'sync_lock' as table_name, COUNT(*) as row_count FROM sync_lock
UNION ALL
SELECT 'cloud_sync_state', COUNT(*) FROM cloud_sync_state;

-- ============================================================================
-- END
-- ============================================================================
