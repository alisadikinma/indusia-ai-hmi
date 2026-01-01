-- ============================================================
-- INDUSIA AI - SEED DATA
-- Run AFTER the main schema setup
-- ============================================================

-- ============================================================
-- 1. ROLES
-- ============================================================
INSERT INTO roles (id, name, description, is_system) VALUES
  ('role_superadmin', 'Super Admin', 'Full system access, RBAC management', true),
  ('role_engineer', 'Engineer', 'Dataset & model management, training jobs', false),
  ('role_manager', 'Manager', 'Review and approve/reject overrides', false),
  ('role_operator', 'Operator', 'Inspection UI, submit false call overrides', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. MENU ITEMS
-- ============================================================
INSERT INTO menu_items (id, name, path) VALUES
  -- Operator menus
  ('menu_dashboard', 'Dashboard', '/dashboard'),
  ('menu_inspection', 'Inspection', '/inspection'),
  ('menu_overrides', 'Overrides', '/overrides'),
  
  -- Manager menus
  ('menu_review', 'Review Overrides', '/review'),
  ('menu_reports', 'Reports', '/reports'),
  
  -- Engineer menus
  ('menu_datasets', 'Datasets', '/datasets'),
  ('menu_training', 'Training', '/training'),
  ('menu_models', 'Models', '/models'),
  
  -- Admin menus
  ('menu_users', 'User Management', '/admin/users'),
  ('menu_roles', 'Role Management', '/admin/roles'),
  ('menu_settings', 'System Settings', '/admin/settings'),
  
  -- Common menus
  ('menu_notifications', 'Notifications', '/notifications'),
  ('menu_eventlog', 'Event Log', '/event-log'),
  ('menu_health', 'System Health', '/system-health')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. ROLE → MENU PERMISSIONS
-- ============================================================

-- Super Admin: ALL menus
INSERT INTO role_menu_permissions (role_id, menu_id)
SELECT 'role_superadmin', id FROM menu_items
ON CONFLICT DO NOTHING;

-- Engineer: datasets, training, models, dashboard, notifications, eventlog
INSERT INTO role_menu_permissions (role_id, menu_id) VALUES
  ('role_engineer', 'menu_dashboard'),
  ('role_engineer', 'menu_datasets'),
  ('role_engineer', 'menu_training'),
  ('role_engineer', 'menu_models'),
  ('role_engineer', 'menu_notifications'),
  ('role_engineer', 'menu_eventlog'),
  ('role_engineer', 'menu_health')
ON CONFLICT DO NOTHING;

-- Manager: review, reports, overrides, dashboard, notifications
INSERT INTO role_menu_permissions (role_id, menu_id) VALUES
  ('role_manager', 'menu_dashboard'),
  ('role_manager', 'menu_review'),
  ('role_manager', 'menu_reports'),
  ('role_manager', 'menu_overrides'),
  ('role_manager', 'menu_notifications'),
  ('role_manager', 'menu_eventlog')
ON CONFLICT DO NOTHING;

-- Operator: inspection, overrides, dashboard, notifications
INSERT INTO role_menu_permissions (role_id, menu_id) VALUES
  ('role_operator', 'menu_dashboard'),
  ('role_operator', 'menu_inspection'),
  ('role_operator', 'menu_overrides'),
  ('role_operator', 'menu_notifications')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. SAMPLE SECTIONS & CUSTOMERS (for testing)
-- ============================================================
INSERT INTO sections (id, name) VALUES
  ('section_smt', 'SMT'),
  ('section_tht', 'THT'),
  ('section_final', 'Final Assembly')
ON CONFLICT (id) DO NOTHING;

INSERT INTO customers (id, name) VALUES
  ('cust_demo', 'Demo Customer'),
  ('cust_internal', 'Internal Testing')
ON CONFLICT (id) DO NOTHING;

INSERT INTO customer_sections (customer_id, section_id) VALUES
  ('cust_demo', 'section_smt'),
  ('cust_demo', 'section_tht'),
  ('cust_internal', 'section_smt'),
  ('cust_internal', 'section_final')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 5. INITIAL ADMIN USER
-- ============================================================
-- Password: "admin123" (you should change this!)
-- In production, use proper password hashing
INSERT INTO users (id, name, email, role_id, sections, password, status)
VALUES (
  'user_admin',
  'System Administrator',
  'admin@indusia.local',
  'role_superadmin',
  ARRAY['section_smt', 'section_tht', 'section_final'],
  'admin123',  -- CHANGE THIS! Use bcrypt hash in production
  'active'
) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 6. SAMPLE BOARDS (for testing overrides)
-- ============================================================
INSERT INTO boards (id, name, customer_id) VALUES
  ('board_demo_001', 'DEMO-PCB-001', 'cust_demo'),
  ('board_demo_002', 'DEMO-PCB-002', 'cust_demo'),
  ('board_test_001', 'TEST-PCB-001', 'cust_internal')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SEED DATA COMPLETE!
-- ============================================================
-- You can now login with:
--   Email: admin@indusia.local
--   Password: admin123 (CHANGE THIS!)
-- ============================================================
