-- =====================================================
-- EXPENSES: ROW LEVEL SECURITY
-- =====================================================
-- 019 created medwise.expenses but never granted access. With RLS enabled the
-- table has no policies, so every insert is rejected ("new row violates
-- row-level security policy" — the "Failed to save expense" toast on the
-- Expenses page) and selects quietly return nothing.
--
-- Same shape as 024 for medwise.expense_categories: expenses are branch/org
-- scoped in the app with no per-user restrictions, so signed-in users get full
-- access, matching the other medwise tables.
-- =====================================================

ALTER TABLE medwise.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read expenses"
  ON medwise.expenses;
CREATE POLICY "Authenticated can read expenses"
  ON medwise.expenses
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated can insert expenses"
  ON medwise.expenses;
CREATE POLICY "Authenticated can insert expenses"
  ON medwise.expenses
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can update expenses"
  ON medwise.expenses;
CREATE POLICY "Authenticated can update expenses"
  ON medwise.expenses
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can delete expenses"
  ON medwise.expenses;
CREATE POLICY "Authenticated can delete expenses"
  ON medwise.expenses
  FOR DELETE
  TO authenticated
  USING (true);
