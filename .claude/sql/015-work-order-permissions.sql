-- ============================================================
-- 015: Work Order Permissions
-- NOTE: Permissions are defined IN CODE, not in database!
-- ============================================================
-- 
-- INDUSIA uses code-based RBAC defined in:
--   lib/auth/rbac.js
--
-- Work Order permissions have been added:
--   'work-orders:read'   -> ['operator', 'manager', 'engineer', 'superadmin']
--   'work-orders:create' -> ['engineer', 'superadmin']
--   'work-orders:update' -> ['engineer', 'superadmin']
--   'work-orders:delete' -> ['engineer', 'superadmin']
--
-- NO DATABASE CHANGES REQUIRED FOR PERMISSIONS
-- ============================================================

-- This file is kept for documentation purposes only.
-- The actual permission changes are in: lib/auth/rbac.js

SELECT 'Work Order permissions are defined in lib/auth/rbac.js' AS note;
