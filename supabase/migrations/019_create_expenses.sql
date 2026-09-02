-- =====================================================
-- EXPENSES MODULE
-- =====================================================
-- Records operating expenses (rent, salaries, utilities, ...) per branch so
-- they can be reported on their own and compared against sales and
-- collections in the Sales vs Collection vs Expenses report.
-- =====================================================

CREATE TABLE IF NOT EXISTS medwise.expenses (
  id BIGSERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  branch_id INTEGER NOT NULL REFERENCES medwise.branches(id),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL,
  description TEXT,
  payee TEXT,
  payment_method TEXT,
  reference_number TEXT,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_expenses_org ON medwise.expenses(org_id);
CREATE INDEX IF NOT EXISTS idx_expenses_branch ON medwise.expenses(branch_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON medwise.expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON medwise.expenses(category);

-- Reports always scope by branch + date window.
CREATE INDEX IF NOT EXISTS idx_expenses_branch_date
  ON medwise.expenses(branch_id, expense_date);

-- =====================================================
-- KEEP updated_at CURRENT
-- =====================================================
CREATE OR REPLACE FUNCTION medwise.touch_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_expenses_updated_at ON medwise.expenses;
CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON medwise.expenses
  FOR EACH ROW
  EXECUTE FUNCTION medwise.touch_expenses_updated_at();
