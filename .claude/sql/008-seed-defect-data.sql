-- ============================================================
-- SEED DATA: Defect Classes & False Call Reasons
-- Based on IPC-A-610 Standards for SMT AOI
-- ============================================================

-- ============================================================
-- 1. DEFECT CLASSES (IPC-A-610 Based)
-- ============================================================

INSERT INTO defect_classes (code, name, category, severity, ipc_reference, description) VALUES

-- SOLDER DEFECTS (Critical & Major)
('SOLDER_BRIDGE', 'Solder Bridge', 'solder', 'critical', 'IPC-A-610 8.2.9', 
 'Solder connecting two or more adjacent conductors that should not be connected'),
 
('SOLDER_SHORT', 'Solder Short', 'solder', 'critical', 'IPC-A-610 8.2.9', 
 'Unintended solder connection between conductors'),
 
('INSUFFICIENT_SOLDER', 'Insufficient Solder', 'solder', 'major', 'IPC-A-610 8.2.5', 
 'Solder joint does not meet minimum fillet requirements'),
 
('EXCESS_SOLDER', 'Excess Solder', 'solder', 'major', 'IPC-A-610 8.2.6', 
 'Solder quantity exceeds acceptable limits'),
 
('COLD_SOLDER', 'Cold Solder Joint', 'solder', 'major', 'IPC-A-610 8.2.7', 
 'Grainy, dull appearance indicating poor wetting'),
 
('SOLDER_BALL', 'Solder Ball', 'solder', 'major', 'IPC-A-610 10.2.7', 
 'Sphere of solder not attached to solder connection'),
 
('NON_WETTING', 'Non-Wetting', 'solder', 'major', 'IPC-A-610 8.2.2', 
 'Solder has not adhered to surface'),
 
('DEWETTING', 'Dewetting', 'solder', 'major', 'IPC-A-610 8.2.3', 
 'Solder has receded from surface after initial wetting'),

-- COMPONENT DEFECTS
('MISSING_COMPONENT', 'Missing Component', 'component', 'critical', 'IPC-A-610 8.3.1', 
 'Component is absent from designated location'),
 
('WRONG_COMPONENT', 'Wrong Component', 'component', 'critical', 'IPC-A-610 8.3.2', 
 'Incorrect component installed at location'),
 
('REVERSED_POLARITY', 'Reversed Polarity', 'component', 'critical', 'IPC-A-610 8.3.3', 
 'Polarized component installed in wrong orientation'),
 
('TOMBSTONE', 'Tombstoning', 'component', 'critical', 'IPC-A-610 8.3.4', 
 'Component standing on end with one termination not soldered'),
 
('MISALIGNMENT', 'Component Misalignment', 'component', 'major', 'IPC-A-610 8.3.5', 
 'Component offset from nominal position beyond tolerance'),
 
('LIFTED_LEAD', 'Lifted Lead', 'component', 'major', 'IPC-A-610 8.3.6', 
 'Component lead not making contact with pad'),
 
('BILLBOARDING', 'Billboarding', 'component', 'major', 'IPC-A-610 8.3.7', 
 'Component tilted on its side'),

-- DAMAGE DEFECTS
('DAMAGED_COMPONENT', 'Damaged Component', 'damage', 'critical', 'IPC-A-610 8.4.1', 
 'Visible physical damage to component body'),
 
('CRACKED_JOINT', 'Cracked Solder Joint', 'damage', 'critical', 'IPC-A-610 8.4.2', 
 'Visible crack in solder joint'),
 
('CONTAMINATION', 'Contamination', 'damage', 'minor', 'IPC-A-610 10.1', 
 'Foreign material on board surface'),
 
('FLUX_RESIDUE', 'Flux Residue', 'damage', 'minor', 'IPC-A-610 10.2', 
 'Excessive flux residue after soldering'),

-- OTHER
('SPURIOUS_COPPER', 'Spurious Copper', 'damage', 'minor', 'IPC-A-610 10.3', 
 'Unintended copper on board surface'),
 
('OTHER', 'Other Defect', 'other', 'major', NULL, 
 'Defect type not in standard categories')

ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  severity = EXCLUDED.severity,
  ipc_reference = EXCLUDED.ipc_reference,
  description = EXCLUDED.description,
  updated_at = NOW();

-- ============================================================
-- 2. FALSE CALL REASONS
-- ============================================================

INSERT INTO false_call_reasons (code, name, description, display_order) VALUES

('REFLECTION', 'Reflection/Lighting Issue', 
 'False detection caused by light reflection or shadow', 1),
 
('ACCEPTABLE_VARIATION', 'Acceptable Variation', 
 'Within acceptable tolerance per IPC standards', 2),
 
('WRONG_CLASSIFICATION', 'Wrong Classification', 
 'AI classified defect type incorrectly', 3),
 
('NORMAL_SOLDER', 'Normal Solder Appearance', 
 'Solder joint is actually acceptable', 4),
 
('BACKGROUND_NOISE', 'Background/Noise', 
 'Detection triggered by PCB pattern or background', 5),
 
('COMPONENT_MARKING', 'Component Marking', 
 'Misidentified component marking as defect', 6),
 
('TRAINING_NEEDED', 'AI Training Needed', 
 'Model needs training for this pattern', 7),
 
('OTHER', 'Other Reason', 
 'Other reason not listed above', 99)

ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order;

-- ============================================================
-- 3. VERIFY DATA
-- ============================================================

-- Check defect classes
SELECT category, severity, COUNT(*) as count 
FROM defect_classes 
GROUP BY category, severity 
ORDER BY category, severity;

-- Check false call reasons
SELECT code, name FROM false_call_reasons ORDER BY display_order;
