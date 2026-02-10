-- ============================================================
-- 032: Add 'on_hold' to work_orders status CHECK constraint
-- Fixes: "new row for relation work_orders violates check constraint work_orders_status_check"
-- Run this in PostgreSQL / Supabase SQL Editor
-- ============================================================

-- Drop the existing constraint
ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS work_orders_status_check;

-- Re-add with 'on_hold' included
ALTER TABLE work_orders ADD CONSTRAINT work_orders_status_check
  CHECK (status IN ('draft', 'ready', 'active', 'on_hold', 'completed', 'closed'));
