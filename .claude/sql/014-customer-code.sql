-- ============================================================
-- 014: Add Customer Code Field
-- For image naming convention
-- ============================================================

-- Add code field to customers table
ALTER TABLE customers 
  ADD COLUMN IF NOT EXISTS code VARCHAR(20);

-- Create unique index on code
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_code 
  ON customers(code) WHERE code IS NOT NULL;

-- Update existing customers with default codes
-- (You should update these with actual customer codes)
UPDATE customers SET code = UPPER(REPLACE(SUBSTRING(name, 1, 4), ' ', '')) 
WHERE code IS NULL;

-- Example: Update specific customers
-- UPDATE customers SET code = 'ACME' WHERE id = 'cust-001';
-- UPDATE customers SET code = 'APEX' WHERE id = 'cust-002';

-- Verify
SELECT id, name, code FROM customers;
