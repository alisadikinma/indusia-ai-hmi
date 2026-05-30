-- ============================================================
-- INDUSIA AI - SEED DATA v3
-- Run AFTER the main schema setup
-- Passwords are plaintext for dev - use bcrypt in production
-- ============================================================

-- ============================================================
-- 1. ROLES
-- ============================================================
INSERT INTO roles (id, name, description, is_system) VALUES
  ('role_superadmin', 'Super Admin', 'Full system access, RBAC management', true),
  ('role_engineer', 'Engineer', 'Dataset & model management, training jobs', false),
  ('role_manager', 'Manager', 'Review and approve/reject overrides', false),
  ('role_operator', 'Operator', 'Inspection UI, submit false call overrides', false)
ON CONFLICT DO NOTHING;

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
ON CONFLICT DO NOTHING;

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

-- Operator: inspection, dashboard, notifications, help
INSERT INTO role_menu_permissions (role_id, menu_id) VALUES
  ('role_operator', 'menu_dashboard'),
  ('role_operator', 'menu_inspection'),
  ('role_operator', 'menu_notifications'),
  ('role_operator', 'menu_help')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. SAMPLE SECTIONS & CUSTOMERS (for testing)
-- ============================================================
INSERT INTO sections (id, name) VALUES
  ('section_smt', 'SMT'),
  ('section_tht', 'THT'),
  ('section_final', 'Final Assembly')
ON CONFLICT DO NOTHING;

INSERT INTO customers (id, name) VALUES
  ('cust_demo', 'Demo Customer'),
  ('cust_internal', 'Internal Testing')
ON CONFLICT DO NOTHING;

INSERT INTO customer_sections (customer_id, section_id) VALUES
  ('cust_demo', 'section_smt'),
  ('cust_demo', 'section_tht'),
  ('cust_internal', 'section_smt'),
  ('cust_internal', 'section_final')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 5. SAMPLE LINES (required for inspection_stats/frames)
-- ============================================================
INSERT INTO lines (id, name, customer_id, section_id) VALUES
  ('line_smt_01', 'SMT Line 1', 'cust_demo', 'section_smt'),
  ('line_smt_02', 'SMT Line 2', 'cust_demo', 'section_smt'),
  ('line_tht_01', 'THT Line 1', 'cust_demo', 'section_tht'),
  ('line_final_01', 'Final Line 1', 'cust_internal', 'section_final')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. ALL USERS (plaintext passwords for dev)
-- ============================================================
-- NOTE: For production, use bcrypt hashed passwords!
-- Install bcrypt: npm install bcrypt
-- Then hash passwords using: await bcrypt.hash('password', 12)

-- Super Admin (password: admin123)
INSERT INTO users (id, name, email, role_id, sections, password, status)
VALUES (
  'user_admin',
  'Admin User',
  'admin@indusia.ai',
  'role_superadmin',
  ARRAY['section_smt', 'section_tht', 'section_final'],
  'admin123',
  'active'
) ON CONFLICT DO NOTHING;

-- Manager (password: manager123)
INSERT INTO users (id, name, email, role_id, sections, password, status)
VALUES (
  'user_manager',
  'Manager User',
  'manager@indusia.ai',
  'role_manager',
  ARRAY['section_smt', 'section_tht'],
  'manager123',
  'active'
) ON CONFLICT DO NOTHING;

-- Operator (password: operator123)
INSERT INTO users (id, name, email, role_id, sections, password, status)
VALUES (
  'user_operator',
  'Operator User',
  'operator@indusia.ai',
  'role_operator',
  ARRAY['section_smt'],
  'operator123',
  'active'
) ON CONFLICT DO NOTHING;

-- Engineer (password: engineer123)
INSERT INTO users (id, name, email, role_id, sections, password, status)
VALUES (
  'user_engineer',
  'Engineer User',
  'engineer@indusia.ai',
  'role_engineer',
  ARRAY['section_smt', 'section_tht', 'section_final'],
  'engineer123',
  'active'
) ON CONFLICT DO NOTHING;

-- ============================================================
-- 7. SAMPLE BOARDS (for testing overrides)
-- ============================================================
INSERT INTO boards (id, name, customer_id) VALUES
  ('board_demo_001', 'DEMO-PCB-001', 'cust_demo'),
  ('board_demo_002', 'DEMO-PCB-002', 'cust_demo'),
  ('board_test_001', 'TEST-PCB-001', 'cust_internal')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 8. DEFECT CLASSES (Master Data for AI Detection)
-- ============================================================
INSERT INTO defect_classes (code, name, category, severity, ipc_reference, description) VALUES
  ('SOLDER_BRIDGE', 'Solder Bridge', 'solder', 'critical', 'IPC-A-610 8.2.9', 'Short circuit between adjacent pads'),
  ('SOLDER_BALL', 'Solder Ball', 'solder', 'major', 'IPC-A-610 10.2.7', 'Stray solder sphere on PCB surface'),
  ('MISSING_COMP', 'Missing Component', 'component', 'critical', 'IPC-A-610 8.3.1', 'Component not placed on designated pad'),
  ('TOMBSTONE', 'Tombstone', 'component', 'critical', 'IPC-A-610 8.3.4', 'Component lifted on one side'),
  ('SHIFTED', 'Component Shifted', 'component', 'major', 'IPC-A-610 8.3.5', 'Component misaligned from pad center'),
  ('POLARITY', 'Polarity Error', 'component', 'critical', 'IPC-A-610 8.3.3', 'Component placed with wrong polarity'),
  ('COLD_SOLDER', 'Cold Solder', 'solder', 'major', 'IPC-A-610 8.2.7', 'Poor solder joint with dull appearance'),
  ('INSUFFICIENT', 'Insufficient Solder', 'solder', 'major', 'IPC-A-610 8.2.5', 'Not enough solder on joint'),
  ('EXCESS', 'Excess Solder', 'solder', 'major', 'IPC-A-610 8.2.6', 'Too much solder on joint'),
  ('CRACK', 'Solder Crack', 'solder', 'major', NULL, 'Visible crack in solder joint'),
  ('VOID', 'Solder Void', 'solder', 'major', NULL, 'Air pocket in solder joint'),
  ('FOREIGN', 'Foreign Material', 'damage', 'major', NULL, 'Contamination on PCB surface')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 9. SHIFT CONFIG (Default 3-shift schedule)
-- ============================================================
-- SMT Section shifts
INSERT INTO shift_config (section_id, shift_number, start_time, end_time) VALUES
  ('section_smt', 1, '07:00:00', '15:00:00'),
  ('section_smt', 2, '15:00:00', '23:00:00'),
  ('section_smt', 3, '23:00:00', '07:00:00')
ON CONFLICT DO NOTHING;

-- THT Section shifts
INSERT INTO shift_config (section_id, shift_number, start_time, end_time) VALUES
  ('section_tht', 1, '07:00:00', '15:00:00'),
  ('section_tht', 2, '15:00:00', '23:00:00'),
  ('section_tht', 3, '23:00:00', '07:00:00')
ON CONFLICT DO NOTHING;

-- Final Assembly Section shifts (2 shifts only)
INSERT INTO shift_config (section_id, shift_number, start_time, end_time) VALUES
  ('section_final', 1, '08:00:00', '17:00:00'),
  ('section_final', 2, '17:00:00', '02:00:00')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED DATA COMPLETE!
-- ============================================================
-- 
-- Login Credentials:
-- ┌─────────────┬───────────────────────┬─────────────┐
-- │ Role        │ Email                 │ Password    │
-- ├─────────────┼───────────────────────┼─────────────┤
-- │ Super Admin │ admin@indusia.ai     │ admin123    │
-- │ Manager     │ manager@indusia.ai   │ manager123  │
-- │ Operator    │ operator@indusia.ai  │ operator123 │
-- │ Engineer    │ engineer@indusia.ai  │ engineer123 │
-- └─────────────┴───────────────────────┴─────────────┘
--
-- NOTE: Passwords stored as plaintext for development.
-- For production, install bcrypt and hash passwords!
-- ============================================================
