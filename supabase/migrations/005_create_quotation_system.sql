-- =====================================================
-- QUOTATION SYSTEM
-- =====================================================

-- =====================================================
-- 1. QUOTATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS medwise.quotations (
  id BIGSERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  branch_id INTEGER NOT NULL REFERENCES medwise.branches(id),
  customer_id INTEGER REFERENCES medwise.customers(id),
  customer_name TEXT NOT NULL,
  quotation_number TEXT UNIQUE NOT NULL,
  quotation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, sent, accepted, rejected, expired
  total_amount DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT
);

-- =====================================================
-- 2. QUOTATION ITEMS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS medwise.quotation_items (
  id BIGSERIAL PRIMARY KEY,
  quotation_id BIGINT NOT NULL REFERENCES medwise.quotations(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES medwise.products(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_quotations_customer ON medwise.quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_branch ON medwise.quotations(branch_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON medwise.quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotations_date ON medwise.quotations(quotation_date);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON medwise.quotation_items(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_items_product ON medwise.quotation_items(product_id);

-- =====================================================
-- FUNCTION: Generate Quotation Number
-- =====================================================
CREATE OR REPLACE FUNCTION medwise.generate_quotation_number()
RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_sequence INTEGER;
  v_number TEXT;
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  -- Get the last quotation number for this year
  SELECT COALESCE(MAX(CAST(SUBSTRING(quotation_number FROM 'Q-' || v_year || '-(.*)') AS INTEGER)), 0) + 1
  INTO v_sequence
  FROM medwise.quotations
  WHERE quotation_number LIKE 'Q-' || v_year || '-%';
  
  v_number := 'Q-' || v_year || '-' || LPAD(v_sequence::TEXT, 6, '0');
  
  RETURN v_number;
END;
$$ LANGUAGE plpgsql;
