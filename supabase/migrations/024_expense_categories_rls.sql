-- =====================================================
-- EXPENSE CATEGORIES: ROW LEVEL SECURITY
-- =====================================================
-- 020 created medwise.expense_categories but never granted access, so with RLS
-- enabled the table was invisible to the app and every insert failed with
-- "new row violates row-level security policy" (the "Failed to add category"
-- toast in Manage Categories).
--
-- Categories are org-level reference data with no per-user restrictions, so
-- signed-in users get full access — the same shape as the other medwise tables.
-- =====================================================

ALTER TABLE medwise.expense_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read expense categories"
  ON medwise.expense_categories;
CREATE POLICY "Authenticated can read expense categories"
  ON medwise.expense_categories
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated can insert expense categories"
  ON medwise.expense_categories;
CREATE POLICY "Authenticated can insert expense categories"
  ON medwise.expense_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can update expense categories"
  ON medwise.expense_categories;
CREATE POLICY "Authenticated can update expense categories"
  ON medwise.expense_categories
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can delete expense categories"
  ON medwise.expense_categories;
CREATE POLICY "Authenticated can delete expense categories"
  ON medwise.expense_categories
  FOR DELETE
  TO authenticated
  USING (true);
