-- =====================================================
-- EXPENSE CATEGORIES
-- =====================================================
-- Replaces the hardcoded expense category list with an editable table so
-- admins can add their own categories.
--
-- `medwise.expenses.category` deliberately stays a TEXT column holding the
-- category NAME rather than becoming a foreign key: historical expenses keep
-- reading correctly even if a category is later removed, and reports group by
-- name. Renaming a category cascades to existing expenses from the app.
-- =====================================================

CREATE TABLE IF NOT EXISTS medwise.expense_categories (
  id BIGSERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Case-insensitive uniqueness per org, so "Rent" and "rent" can't coexist.
CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_categories_org_name
  ON medwise.expense_categories(org_id, LOWER(name));

CREATE INDEX IF NOT EXISTS idx_expense_categories_org
  ON medwise.expense_categories(org_id);

-- =====================================================
-- SEED: the previously hardcoded defaults, for every existing org
-- =====================================================
INSERT INTO medwise.expense_categories (org_id, name)
SELECT o.org_id, d.name
FROM (SELECT DISTINCT org_id FROM medwise.branches WHERE org_id IS NOT NULL) o
CROSS JOIN (
  VALUES
    ('Rent'),
    ('Salaries & Wages'),
    ('Utilities'),
    ('Transportation & Delivery'),
    ('Office & Store Supplies'),
    ('Taxes & Licenses'),
    ('Repairs & Maintenance'),
    ('Marketing & Advertising'),
    ('Professional Fees'),
    ('Bank Charges'),
    ('Miscellaneous')
) AS d(name)
ON CONFLICT DO NOTHING;

-- Any category already used by an expense but missing from the seed (for
-- example one typed before this migration) is carried over too.
INSERT INTO medwise.expense_categories (org_id, name)
SELECT DISTINCT e.org_id, e.category
FROM medwise.expenses e
WHERE e.category IS NOT NULL
  AND TRIM(e.category) <> ''
ON CONFLICT DO NOTHING;
