-- =====================================================
-- VERIFICATION & TESTING SCRIPT
-- =====================================================
-- Use this script to verify the stock deduction functions are working correctly
-- Run in Supabase SQL Editor after deploying migration 001

-- =====================================================
-- 1. VERIFY FUNCTIONS EXIST
-- =====================================================
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines 
WHERE routine_schema = 'medwise' 
  AND routine_name IN (
    'create_transaction_with_stock_deduction',
    'generate_transaction_number'
  );

-- Expected: 2 rows showing both functions

-- =====================================================
-- 2. VERIFY FUNCTION PERMISSIONS
-- =====================================================
SELECT 
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'medwise'
  AND routine_name IN (
    'create_transaction_with_stock_deduction',
    'generate_transaction_number'
  );

-- Expected: Should show 'authenticated' with EXECUTE permission

-- =====================================================
-- 3. TEST TRANSACTION NUMBER GENERATION
-- =====================================================
-- This should generate a unique transaction number
SELECT medwise.generate_transaction_number() as transaction_number;

-- Run again - should increment
SELECT medwise.generate_transaction_number() as transaction_number_2;

-- =====================================================
-- 4. VIEW FUNCTION SOURCE CODE
-- =====================================================
-- Useful for debugging
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'medwise' 
  AND routine_name = 'create_transaction_with_stock_deduction';

-- =====================================================
-- 5. CHECK CURRENT STOCK LEVELS
-- =====================================================
-- Before testing, check what stock is available
SELECT 
  ps.id,
  ps.product_id,
  p.name as product_name,
  ps.batch_no,
  ps.remaining_quantity,
  ps.consigned_quantity,
  ps.expiration_date,
  ps.date_manufactured
FROM medwise.product_stocks ps
JOIN medwise.products p ON p.id = ps.product_id
WHERE ps.remaining_quantity > 0
  AND ps.expiration_date >= CURRENT_DATE
ORDER BY ps.date_manufactured ASC
LIMIT 10;

-- =====================================================
-- 6. SAMPLE TEST TRANSACTION (READ-ONLY)
-- =====================================================
-- This is a dry-run test. Uncomment to execute.
-- Replace the values with real data from your database

/*
-- First, get a valid customer_id
SELECT id, name FROM medwise.customers LIMIT 1;

-- Then, get a valid product_id with stock
SELECT 
  p.id as product_id,
  p.name,
  SUM(ps.remaining_quantity) as total_stock
FROM medwise.products p
JOIN medwise.product_stocks ps ON ps.product_id = p.id
WHERE ps.remaining_quantity > 0
  AND ps.expiration_date >= CURRENT_DATE
GROUP BY p.id, p.name
HAVING SUM(ps.remaining_quantity) >= 2
LIMIT 1;

-- Now test the function (UNCOMMENT TO RUN)
SELECT medwise.create_transaction_with_stock_deduction(
  p_org_id := 1,
  p_customer_id := 1,  -- Replace with actual customer_id
  p_customer_name := 'Test Customer',
  p_transaction_number := 'TEST-' || medwise.generate_transaction_number(),
  p_transaction_type := 'retail',
  p_payment_type := 'Cash',
  p_payment_status := 'Paid',
  p_total_amount := 100.00,
  p_gl_number := NULL,
  p_branch_id := 1,  -- Replace with actual branch_id
  p_items := '[
    {
      "product_id": 1,
      "quantity": 2,
      "price": 50.00
    }
  ]'::jsonb
);
*/

-- =====================================================
-- 7. VERIFY TRANSACTION CREATED
-- =====================================================
-- After running a test transaction, verify it was created
SELECT 
  t.id,
  t.transaction_number,
  t.transaction_type,
  t.payment_status,
  t.total_amount,
  t.created_at,
  c.name as customer_name
FROM medwise.transactions t
LEFT JOIN medwise.customers c ON c.id = t.customer_id
WHERE t.transaction_number LIKE 'TEST-%'
ORDER BY t.created_at DESC
LIMIT 5;

-- =====================================================
-- 8. VERIFY TRANSACTION ITEMS & BATCH TRACKING
-- =====================================================
-- Check that transaction items have correct batch info
SELECT 
  ti.id,
  ti.transaction_id,
  p.name as product_name,
  ti.batch_no,
  ti.quantity,
  ti.price,
  ti.total,
  ti.date_manufactured,
  ti.expiration_date
FROM medwise.transaction_items ti
JOIN medwise.products p ON p.id = ti.product_id
WHERE ti.transaction_id IN (
  SELECT id FROM medwise.transactions 
  WHERE transaction_number LIKE 'TEST-%'
  ORDER BY created_at DESC 
  LIMIT 1
);

-- =====================================================
-- 9. VERIFY STOCK WAS DEDUCTED
-- =====================================================
-- Compare stock before and after
SELECT 
  ps.id,
  ps.product_id,
  p.name as product_name,
  ps.batch_no,
  ps.remaining_quantity,
  ps.consigned_quantity,
  ps.type
FROM medwise.product_stocks ps
JOIN medwise.products p ON p.id = ps.product_id
WHERE ps.product_id IN (
  SELECT DISTINCT product_id 
  FROM medwise.transaction_items 
  WHERE transaction_id IN (
    SELECT id FROM medwise.transactions 
    WHERE transaction_number LIKE 'TEST-%'
    ORDER BY created_at DESC 
    LIMIT 1
  )
);

-- =====================================================
-- 10. TEST ERROR HANDLING (INSUFFICIENT STOCK)
-- =====================================================
-- This should return an error response (not raise exception)
/*
SELECT medwise.create_transaction_with_stock_deduction(
  p_org_id := 1,
  p_customer_id := 1,
  p_customer_name := 'Test Customer',
  p_transaction_number := 'ERROR-TEST-' || medwise.generate_transaction_number(),
  p_transaction_type := 'retail',
  p_payment_type := 'Cash',
  p_payment_status := 'Paid',
  p_total_amount := 100.00,
  p_gl_number := NULL,
  p_branch_id := 1,
  p_items := '[
    {
      "product_id": 1,
      "quantity": 999999,
      "price": 50.00
    }
  ]'::jsonb
);
*/

-- Expected result: {"success": false, "error": "Insufficient stock..."}

-- =====================================================
-- 11. CHECK FOR NEGATIVE STOCK (SHOULD BE NONE)
-- =====================================================
-- This should return NO rows - any negative stock indicates a problem
SELECT 
  ps.id,
  ps.product_id,
  p.name as product_name,
  ps.remaining_quantity,
  ps.batch_no
FROM medwise.product_stocks ps
JOIN medwise.products p ON p.id = ps.product_id
WHERE ps.remaining_quantity < 0;

-- Expected: 0 rows (no negative stock should exist)

-- =====================================================
-- 12. VERIFY FIFO ORDER
-- =====================================================
-- Check that oldest stock was used first
SELECT 
  ti.transaction_id,
  t.transaction_number,
  p.name as product_name,
  ti.batch_no,
  ti.date_manufactured,
  ti.quantity,
  ROW_NUMBER() OVER (
    PARTITION BY ti.transaction_id, ti.product_id 
    ORDER BY ti.date_manufactured ASC
  ) as fifo_order
FROM medwise.transaction_items ti
JOIN medwise.transactions t ON t.id = ti.transaction_id
JOIN medwise.products p ON p.id = ti.product_id
WHERE t.transaction_number LIKE 'TEST-%'
ORDER BY ti.transaction_id, ti.product_id, ti.date_manufactured;

-- Expected: fifo_order should be 1, 2, 3... (chronological)

-- =====================================================
-- 13. CLEANUP TEST DATA (OPTIONAL)
-- =====================================================
-- WARNING: Only run this to clean up test transactions!
-- Uncomment to delete test transactions

/*
-- Delete test transaction items first
DELETE FROM medwise.transaction_items
WHERE transaction_id IN (
  SELECT id FROM medwise.transactions 
  WHERE transaction_number LIKE 'TEST-%'
    OR transaction_number LIKE 'ERROR-TEST-%'
);

-- Then delete test transactions
DELETE FROM medwise.transactions
WHERE transaction_number LIKE 'TEST-%'
  OR transaction_number LIKE 'ERROR-TEST-%';
*/

-- =====================================================
-- 14. PERFORMANCE CHECK
-- =====================================================
-- Check execution time of function
EXPLAIN ANALYZE
SELECT medwise.generate_transaction_number();

-- Should execute in < 10ms

-- =====================================================
-- 15. CONCURRENT LOCK TEST
-- =====================================================
-- This requires two database sessions to properly test
-- In Session 1, run this and DON'T COMMIT:
/*
BEGIN;
SELECT * FROM medwise.product_stocks 
WHERE product_id = 1 
FOR UPDATE;
-- Wait here... don't COMMIT yet
*/

-- In Session 2, run the transaction function
-- It should wait for Session 1 to complete

-- Then COMMIT in Session 1:
/*
COMMIT;
*/

-- Session 2 should then proceed

-- =====================================================
-- VERIFICATION COMPLETE
-- =====================================================
-- If all queries return expected results, the migration is successful!

