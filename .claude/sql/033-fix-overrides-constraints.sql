-- =============================================
-- FIX OVERRIDES TABLE CONSTRAINTS
-- =============================================
-- Problem: LiveViewV3 creates overrides with:
--   board_id = synthetic ID like "WO-20260210-0002-0001" (not a boards table FK)
--   override_type = 'FALSE_POSITIVE' or 'MISSED_DEFECT' (not matching CHECK values)
-- Both cause silent INSERT failures due to FK and CHECK constraints.

-- 1. Drop FK constraint on board_id
-- board_id stores synthetic inspection IDs (WO-xxx-0001), NOT boards table FKs
ALTER TABLE overrides DROP CONSTRAINT IF EXISTS overrides_board_id_fkey;

-- 2. Drop old CHECK constraint on override_type (values don't match code)
ALTER TABLE overrides DROP CONSTRAINT IF EXISTS overrides_override_type_check;

-- 3. Add replacement CHECK with all values used by the codebase:
--    LiveViewV3 sends: FALSE_POSITIVE, MISSED_DEFECT
--    OverrideWizard sends: false_positive_no_defect, false_positive_acceptable, misclassification, false_negative
ALTER TABLE overrides ADD CONSTRAINT overrides_override_type_check
  CHECK (override_type IN (
    'FALSE_POSITIVE', 'MISSED_DEFECT',
    'false_positive_no_defect', 'false_positive_acceptable',
    'misclassification', 'false_negative', 'other'
  ));

-- Verify constraints
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'overrides'::regclass
ORDER BY conname;
