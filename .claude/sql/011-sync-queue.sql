-- ============================================================
-- SYNC QUEUE TABLE
-- Track false call records pending upload to cloud training
-- ============================================================

CREATE TABLE IF NOT EXISTS sync_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Reference to inspection
  inspection_id UUID REFERENCES inspection_results(id) ON DELETE CASCADE,
  
  -- Denormalized for quick display (avoid joins)
  board_id VARCHAR(50) NOT NULL,
  customer_name VARCHAR(100),
  section_name VARCHAR(100),
  line_name VARCHAR(100),
  defect_type VARCHAR(50),
  defect_count INTEGER DEFAULT 1,
  
  -- Local image path
  local_image_path TEXT,
  local_crop_path TEXT,
  
  -- Cloud storage path (after sync)
  cloud_image_path TEXT,
  cloud_crop_path TEXT,
  
  -- Status: pending, syncing, synced, failed
  status VARCHAR(20) DEFAULT 'pending',
  sync_error TEXT,
  
  -- Sync tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ,
  synced_by TEXT, -- user_id who triggered sync
  
  -- For grouping in UI
  record_type VARCHAR(30) DEFAULT 'false_call' -- false_call, override, inspection
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON sync_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_queue_inspection ON sync_queue(inspection_id);

-- ============================================================
-- SYNC HISTORY TABLE  
-- Log of completed sync operations
-- ============================================================

CREATE TABLE IF NOT EXISTS sync_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Summary
  record_count INTEGER NOT NULL,
  success_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  
  -- Status: success, partial, failed
  status VARCHAR(20) NOT NULL,
  error_message TEXT,
  
  -- Timing
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  -- Who triggered
  triggered_by TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_history_created ON sync_history(created_at DESC);
