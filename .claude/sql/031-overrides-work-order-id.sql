-- =============================================
-- ADD work_order_id TO OVERRIDES TABLE
-- Links overrides to their parent work order
-- for scoped duplicate detection
-- =============================================

-- Add work_order_id column with FK reference
ALTER TABLE overrides ADD COLUMN IF NOT EXISTS work_order_id UUID REFERENCES work_orders(id);

-- Index for duplicate check: board_id + work_order_id
CREATE INDEX IF NOT EXISTS idx_overrides_board_wo
  ON overrides (board_id, work_order_id);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'overrides' AND column_name = 'work_order_id';
