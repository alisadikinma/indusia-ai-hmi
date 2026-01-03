-- =============================================
-- System Status Seed Data
-- Phase 14: Validation & Database
-- =============================================
-- Initial system status records

INSERT INTO system_status (id, component, component_id, status, message, metadata)
VALUES
  ('ai_model', 'ai_model', NULL, 'UNKNOWN', 'No model loaded', '{}'),
  ('camera-cam-01', 'camera', 'cam-01', 'UNKNOWN', 'Waiting for connection', '{"name": "Top Camera"}'),
  ('camera-cam-02', 'camera', 'cam-02', 'UNKNOWN', 'Waiting for connection', '{"name": "Bottom Camera"}'),
  ('plc-plc-01', 'plc', 'plc-01', 'UNKNOWN', 'Waiting for connection', '{"name": "Conveyor PLC"}')
ON CONFLICT (id) DO NOTHING;
