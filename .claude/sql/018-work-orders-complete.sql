-- ============================================================
-- 018: Work Orders Table + Seed Data (Combined)
-- Creates work_orders table and seeds sample data
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- PART 1: Create work_orders table
-- ============================================================

-- Drop if exists (for clean setup)
DROP TABLE IF EXISTS work_orders CASCADE;

-- Create work_orders table with TEXT foreign keys (matching master data)
CREATE TABLE work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_number VARCHAR(30) NOT NULL UNIQUE,
  
  -- Foreign keys (TEXT to match master data tables)
  customer_id TEXT NOT NULL REFERENCES customers(id),
  board_id TEXT NOT NULL REFERENCES boards(id),
  line_id TEXT NOT NULL REFERENCES lines(id),
  section_id TEXT REFERENCES sections(id),
  
  -- Lot configuration
  lot_size INTEGER NOT NULL DEFAULT 100,
  side_count INTEGER NOT NULL DEFAULT 1 CHECK (side_count IN (1, 2)),
  
  -- Scheduling
  due_date DATE,
  priority INTEGER DEFAULT 0, -- 0=normal, 50=high, 100=urgent
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'draft' 
    CHECK (status IN ('draft', 'ready', 'active', 'on_hold', 'completed', 'closed')),
  
  -- Counters (operator-confirmed)
  completed_qty INTEGER NOT NULL DEFAULT 0,
  good_qty INTEGER NOT NULL DEFAULT 0,
  ng_qty INTEGER NOT NULL DEFAULT 0,
  false_call_qty INTEGER NOT NULL DEFAULT 0,
  
  -- Audit
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Notes
  notes TEXT
);

-- Indexes
CREATE INDEX idx_work_orders_status ON work_orders(status);
CREATE INDEX idx_work_orders_line ON work_orders(line_id, status);
CREATE INDEX idx_work_orders_customer ON work_orders(customer_id);
CREATE INDEX idx_work_orders_created ON work_orders(created_at DESC);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_work_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_work_orders_updated_at
BEFORE UPDATE ON work_orders
FOR EACH ROW
EXECUTE FUNCTION update_work_orders_updated_at();

-- ============================================================
-- PART 2: Update inspection_results to reference work_orders
-- ============================================================

-- Add work order reference columns to inspection_results (if not exists)
DO $$
BEGIN
  -- Add work_order_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inspection_results' AND column_name = 'work_order_id'
  ) THEN
    ALTER TABLE inspection_results ADD COLUMN work_order_id UUID REFERENCES work_orders(id);
  END IF;
  
  -- Add side column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inspection_results' AND column_name = 'side'
  ) THEN
    ALTER TABLE inspection_results ADD COLUMN side VARCHAR(10) DEFAULT 'TOP';
  END IF;
  
  -- Add board_sequence column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inspection_results' AND column_name = 'board_sequence'
  ) THEN
    ALTER TABLE inspection_results ADD COLUMN board_sequence INTEGER;
  END IF;
END $$;

-- ============================================================
-- PART 3: Seed Master Data (if not exists)
-- ============================================================

-- Insert customer if not exists
INSERT INTO customers (id, name)
VALUES ('cust-demo-001', 'ACME Electronics')
ON CONFLICT (id) DO NOTHING;

-- Update customer code
UPDATE customers SET code = 'ACME' WHERE id = 'cust-demo-001' AND (code IS NULL OR code = '');

-- Insert section if not exists
INSERT INTO sections (id, name)
VALUES ('sect-demo-001', 'SMT Production')
ON CONFLICT (id) DO NOTHING;

-- Insert customer_sections mapping
INSERT INTO customer_sections (customer_id, section_id)
VALUES ('cust-demo-001', 'sect-demo-001')
ON CONFLICT DO NOTHING;

-- Insert lines if not exists
INSERT INTO lines (id, name, customer_id, section_id)
VALUES 
  ('line-demo-001', 'Line 01', 'cust-demo-001', 'sect-demo-001'),
  ('line-demo-002', 'Line 02', 'cust-demo-001', 'sect-demo-001')
ON CONFLICT (id) DO NOTHING;

-- Insert boards if not exists
INSERT INTO boards (id, name, customer_id)
VALUES 
  ('board-demo-001', 'Main Controller PCB', 'cust-demo-001'),
  ('board-demo-002', 'Power Supply PCB', 'cust-demo-001')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- PART 4: Seed Work Orders
-- ============================================================

-- Get first user ID for created_by (handles both TEXT and UUID id types)
DO $$
DECLARE
  v_user_id TEXT;
BEGIN
  -- Try to get any existing user
  SELECT id INTO v_user_id FROM users LIMIT 1;
  
  -- If no user exists, v_user_id will be NULL (which is OK, created_by allows NULL)
  
  -- WO 1: Draft - Single side
  INSERT INTO work_orders (
    wo_number, customer_id, board_id, line_id, section_id,
    lot_size, side_count, due_date, priority, status,
    completed_qty, good_qty, ng_qty, false_call_qty,
    created_by, notes
  ) VALUES (
    'WO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-0001',
    'cust-demo-001', 'board-demo-001', 'line-demo-001', 'sect-demo-001',
    100, 1, CURRENT_DATE + INTERVAL '3 days', 0, 'draft',
    0, 0, 0, 0,
    v_user_id, 'Standard production run - TOP only inspection'
  ) ON CONFLICT (wo_number) DO NOTHING;

  -- WO 2: Active - Dual side (in progress)
  INSERT INTO work_orders (
    wo_number, customer_id, board_id, line_id, section_id,
    lot_size, side_count, due_date, priority, status,
    completed_qty, good_qty, ng_qty, false_call_qty,
    created_by, started_at, notes
  ) VALUES (
    'WO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-0002',
    'cust-demo-001', 'board-demo-001', 'line-demo-001', 'sect-demo-001',
    50, 2, CURRENT_DATE + INTERVAL '1 day', 50, 'active',
    23, 20, 2, 1,
    v_user_id, NOW() - INTERVAL '2 hours', 
    'Rush order - TOP + BOTTOM inspection required'
  ) ON CONFLICT (wo_number) DO NOTHING;

  -- WO 3: Completed yesterday
  INSERT INTO work_orders (
    wo_number, customer_id, board_id, line_id, section_id,
    lot_size, side_count, due_date, priority, status,
    completed_qty, good_qty, ng_qty, false_call_qty,
    created_by, started_at, completed_at, notes
  ) VALUES (
    'WO-' || TO_CHAR(CURRENT_DATE - INTERVAL '1 day', 'YYYYMMDD') || '-0001',
    'cust-demo-001', 'board-demo-001', 'line-demo-001', 'sect-demo-001',
    100, 1, CURRENT_DATE, 0, 'completed',
    100, 95, 4, 1,
    v_user_id, 
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '4 hours',
    'Completed standard run - 95% yield'
  ) ON CONFLICT (wo_number) DO NOTHING;

  -- WO 4: High priority draft for Line 2
  INSERT INTO work_orders (
    wo_number, customer_id, board_id, line_id, section_id,
    lot_size, side_count, due_date, priority, status,
    completed_qty, good_qty, ng_qty, false_call_qty,
    created_by, notes
  ) VALUES (
    'WO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-0003',
    'cust-demo-001', 'board-demo-002', 'line-demo-002', 'sect-demo-001',
    200, 2, CURRENT_DATE, 100, 'draft',
    0, 0, 0, 0,
    v_user_id, 'URGENT - Customer express order - Power board'
  ) ON CONFLICT (wo_number) DO NOTHING;

  -- WO 5: Ready status for Line 2
  INSERT INTO work_orders (
    wo_number, customer_id, board_id, line_id, section_id,
    lot_size, side_count, due_date, priority, status,
    completed_qty, good_qty, ng_qty, false_call_qty,
    created_by, notes
  ) VALUES (
    'WO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-0004',
    'cust-demo-001', 'board-demo-001', 'line-demo-002', 'sect-demo-001',
    150, 1, CURRENT_DATE + INTERVAL '2 days', 0, 'ready',
    0, 0, 0, 0,
    v_user_id, 'Prepared for Line 2 - waiting for line availability'
  ) ON CONFLICT (wo_number) DO NOTHING;

  RAISE NOTICE 'Work orders seeded successfully';
END $$;

-- ============================================================
-- PART 5: Verification Queries
-- ============================================================

-- Show all work orders
SELECT 
  wo_number,
  status,
  lot_size,
  side_count,
  completed_qty,
  good_qty,
  ng_qty,
  false_call_qty,
  CASE WHEN completed_qty > 0 
    THEN ROUND((good_qty::NUMERIC / completed_qty) * 100, 1) 
    ELSE 100 
  END as yield_pct,
  ROUND((completed_qty::NUMERIC / lot_size) * 100, 1) as progress_pct,
  priority,
  notes
FROM work_orders
ORDER BY created_at DESC;

-- Show active WO per line
SELECT 
  l.name as line_name,
  w.wo_number,
  w.status,
  w.lot_size,
  w.completed_qty,
  w.good_qty,
  w.ng_qty
FROM work_orders w
JOIN lines l ON l.id = w.line_id
WHERE w.status = 'active';

-- Show master data summary
SELECT 
  'Customers' as entity, COUNT(*) as count FROM customers
UNION ALL
SELECT 'Sections', COUNT(*) FROM sections
UNION ALL
SELECT 'Lines', COUNT(*) FROM lines
UNION ALL
SELECT 'Boards', COUNT(*) FROM boards
UNION ALL
SELECT 'Work Orders', COUNT(*) FROM work_orders;
