-- Migration: Add completion tracking fields to work_orders
-- Tracks reason for force-completing incomplete WOs and who completed them

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS completion_reason TEXT,
  ADD COLUMN IF NOT EXISTS completed_by TEXT;
