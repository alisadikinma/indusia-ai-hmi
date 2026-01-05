-- ============================================================
-- 012-update-menu-permissions.sql
-- Add missing menu_items and update permissions to match UI
-- Based on Permission Matrix & existing data
-- ============================================================

-- Step 1: Add ONLY missing menu_items (keep existing ones)
INSERT INTO menu_items (id, name, path) VALUES
  ('menu_engineering', 'Engineering Console', '/engineering/master-data'),
  ('menu_work_orders', 'Work Orders', '/engineering/work-orders'),
  ('menu_sync', 'Sync to Cloud', '/settings/sync'),
  ('menu_permissions', 'Permissions', '/super-admin/permissions'),
  ('menu_help', 'Help Overlay', '/help')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  path = EXCLUDED.path;

-- Step 2: Add missing permissions based on Permission Matrix
-- (Only INSERT, don't delete existing permissions)

-- SuperAdmin: Add new menus
INSERT INTO role_menu_permissions (role_id, menu_id) VALUES
  ('role_superadmin', 'menu_engineering'),
  ('role_superadmin', 'menu_work_orders'),
  ('role_superadmin', 'menu_sync'),
  ('role_superadmin', 'menu_permissions'),
  ('role_superadmin', 'menu_help')
ON CONFLICT DO NOTHING;

-- Engineer: Engineering Console + Work Orders (from Matrix)
INSERT INTO role_menu_permissions (role_id, menu_id) VALUES
  ('role_engineer', 'menu_engineering'),
  ('role_engineer', 'menu_work_orders'),
  ('role_engineer', 'menu_help')
ON CONFLICT DO NOTHING;

-- Manager: menu_inspection (HMI) + menu_sync (from Matrix)
INSERT INTO role_menu_permissions (role_id, menu_id) VALUES
  ('role_manager', 'menu_inspection'),
  ('role_manager', 'menu_sync'),
  ('role_manager', 'menu_help')
ON CONFLICT DO NOTHING;

-- Operator: menu_help only (menu_inspection already exists)
INSERT INTO role_menu_permissions (role_id, menu_id) VALUES
  ('role_operator', 'menu_help')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Verification: Run this to check results
-- ============================================================
-- SELECT r.id as role_id, array_agg(rmp.menu_id ORDER BY rmp.menu_id) as menus
-- FROM roles r
-- LEFT JOIN role_menu_permissions rmp ON r.id = rmp.role_id
-- GROUP BY r.id
-- ORDER BY r.id;
