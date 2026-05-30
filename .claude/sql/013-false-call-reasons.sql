-- =====================================================
-- False Call Reasons Table & Initial Data
-- Run this in Supabase SQL Editor
-- =====================================================

-- Create table if not exists
CREATE TABLE IF NOT EXISTS false_call_reasons (
  id TEXT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clear existing data (optional - comment out if you want to keep existing data)
-- DELETE FROM false_call_reasons;

-- Insert initial false call reasons
INSERT INTO false_call_reasons (id, code, name, description, sort_order) VALUES
  ('fcr_reflection', 'REFLECTION', 'Lighting Reflection', 'AI detected reflection as defect', 1),
  ('fcr_acceptable', 'ACCEPTABLE_VARIATION', 'Acceptable Variation', 'Variation within IPC tolerance limits', 2),
  ('fcr_wrong_class', 'WRONG_CLASSIFICATION', 'Wrong Classification', 'AI detected wrong defect type', 3),
  ('fcr_normal_solder', 'NORMAL_SOLDER', 'Normal Solder Joint', 'Normal solder joint misidentified as defect', 4),
  ('fcr_shadow', 'SHADOW', 'Shadow/Lighting Issue', 'Shadow caused by lighting angle', 5),
  ('fcr_dust', 'DUST_PARTICLE', 'Dust/Particle', 'Dust or particle on board surface', 6),
  ('fcr_marking', 'MARKING', 'Board Marking', 'Silkscreen or marking misidentified', 7),
  ('fcr_other', 'OTHER', 'Other', 'Other reason (requires comment)', 99)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- Verify data
SELECT * FROM false_call_reasons ORDER BY sort_order;
