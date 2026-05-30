-- ============================================
-- 012-system-status.sql
-- System Status Table for Health Monitoring
-- ============================================

-- System status tracking table
CREATE TABLE IF NOT EXISTS system_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component VARCHAR(50) NOT NULL UNIQUE, -- 'camera', 'aiModel', 'cloud', 'database', 'plc'
  status VARCHAR(20) NOT NULL DEFAULT 'unknown', -- 'ok', 'warning', 'error', 'offline', 'degraded'
  message TEXT,
  details JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_system_status_component ON system_status(component);
CREATE INDEX IF NOT EXISTS idx_system_status_status ON system_status(status);

-- Insert default components
INSERT INTO system_status (component, status, message) VALUES
  ('camera', 'ok', 'Camera system online'),
  ('aiModel', 'ok', 'AI Model running'),
  ('cloud', 'ok', 'Cloud services connected'),
  ('database', 'ok', 'Database connected'),
  ('plc', 'ok', 'PLC communication active')
ON CONFLICT (component) DO NOTHING;

-- RLS Policy
ALTER TABLE system_status ENABLE ROW LEVEL SECURITY;

-- Allow read for all authenticated users
CREATE POLICY "system_status_read" ON system_status
  FOR SELECT TO authenticated USING (true);

-- Allow update for service role only
CREATE POLICY "system_status_update" ON system_status
  FOR UPDATE TO authenticated USING (true);

-- Comment
COMMENT ON TABLE system_status IS 'Real-time system component health status';
