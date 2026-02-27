-- Migration: Create system_settings key-value table
-- Stores system-level configuration like company logo, company name, etc.

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by TEXT
);

-- Seed default company name
INSERT INTO system_settings (key, value) VALUES ('company_name', 'PCI Batam')
ON CONFLICT (key) DO NOTHING;
