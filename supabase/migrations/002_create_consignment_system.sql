-- =====================================================
-- PROPER CONSIGNMENT SYSTEM FOR POS
-- =====================================================
-- This creates a monthly-based consignment tracking system
-- where products are given to customers on consignment,
-- tracked monthly with balances, sales, and returns

-- =====================================================
-- 1. CONSIGNMENTS TABLE (Main consignment record)
-- =====================================================
CREATE TABLE IF NOT EXISTS medwise.consignments (
  id BIGSERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  branch_id INTEGER NOT NULL REFERENCES medwise.branches(id),
  customer_id INTEGER NOT NULL REFERENCES medwise.customers(id),
  customer_name TEXT NOT NULL,
  consignment_number TEXT UNIQUE NOT NULL,
  
  -- Monthly tracking
  month INTEGER NOT NULL, -- 1-12
  year INTEGER NOT NULL,  -- e.g., 2025
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'active', -- active, settled, closed
  
  -- Balances
  previous_balance_qty INTEGER DEFAULT 0, -- Items remaining from last month
  new_items_qty INTEGER DEFAULT 0,        -- New items added this month
  sold_qty INTEGER DEFAULT 0,             -- Items sold this month
  returned_qty INTEGER DEFAULT 0,         -- Items returned to inventory
  current_balance_qty INTEGER DEFAULT 0,  -- Items still with customer
  
  -- Financial
  total_consigned_value DECIMAL(10,2) DEFAULT 0,
  total_sold_value DECIMAL(10,2) DEFAULT 0,
  total_paid DECIMAL(10,2) DEFAULT 0,
  balance_due DECIMAL(10,2) DEFAULT 0,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT,
  
  -- Ensure one consignment per customer per month
  UNIQUE(customer_id, year, month, branch_id)
);

-- =====================================================
-- 2. CONSIGNMENT ITEMS TABLE (Products in consignment)
-- =====================================================
CREATE TABLE IF NOT EXISTS medwise.consignment_items (
  id BIGSERIAL PRIMARY KEY,
  consignment_id BIGINT NOT NULL REFERENCES medwise.consignments(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES medwise.products(id),
  product_stock_id BIGINT REFERENCES medwise.product_stocks(id),
  
  -- Batch info
  batch_no TEXT,
  date_manufactured DATE,
  expiration_date DATE,
  
  -- Quantities
  previous_balance INTEGER DEFAULT 0, -- From last month
  quantity_added INTEGER DEFAULT 0,   -- New items this entry
  quantity_sold INTEGER DEFAULT 0,    -- Sold this month
  quantity_returned INTEGER DEFAULT 0, -- Returned to inventory
  current_balance INTEGER DEFAULT 0,  -- Still with customer
  
  -- Pricing
  unit_price DECIMAL(10,2) NOT NULL,
  total_value DECIMAL(10,2) NOT NULL,
  
  -- Transaction tracking (when sold)
  transaction_id BIGINT REFERENCES medwise.transactions(id),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 3. CONSIGNMENT HISTORY TABLE (Activity log)
-- =====================================================
CREATE TABLE IF NOT EXISTS medwise.consignment_history (
  id BIGSERIAL PRIMARY KEY,
  consignment_id BIGINT NOT NULL REFERENCES medwise.consignments(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'created', 'items_added', 'sale_recorded', 'items_returned', 'settled', 'closed'
  
  -- Details
  product_id INTEGER REFERENCES medwise.products(id),
  quantity INTEGER,
  amount DECIMAL(10,2),
  
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_consignments_customer ON medwise.consignments(customer_id);
CREATE INDEX IF NOT EXISTS idx_consignments_branch ON medwise.consignments(branch_id);
CREATE INDEX IF NOT EXISTS idx_consignments_status ON medwise.consignments(status);
CREATE INDEX IF NOT EXISTS idx_consignments_month_year ON medwise.consignments(year, month);
CREATE INDEX IF NOT EXISTS idx_consignment_items_consignment ON medwise.consignment_items(consignment_id);
CREATE INDEX IF NOT EXISTS idx_consignment_items_product ON medwise.consignment_items(product_id);
CREATE INDEX IF NOT EXISTS idx_consignment_history_consignment ON medwise.consignment_history(consignment_id);

-- =====================================================
-- FUNCTION: Generate Consignment Number
-- =====================================================
CREATE OR REPLACE FUNCTION medwise.generate_consignment_number()
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_last_number TEXT;
  v_next_sequence INTEGER;
BEGIN
  -- Prefix: CONS-YYYYMM
  v_prefix := 'CONS-' || TO_CHAR(CURRENT_DATE, 'YYYYMM');
  
  -- Get last consignment number for this month
  SELECT consignment_number INTO v_last_number
  FROM medwise.consignments
  WHERE consignment_number LIKE v_prefix || '-%'
  ORDER BY consignment_number DESC
  LIMIT 1;
  
  -- Calculate next sequence
  IF v_last_number IS NULL THEN
    v_next_sequence := 1;
  ELSE
    v_next_sequence := SPLIT_PART(v_last_number, '-', 3)::INTEGER + 1;
  END IF;
  
  RETURN v_prefix || '-' || LPAD(v_next_sequence::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Create New Consignment
-- =====================================================
CREATE OR REPLACE FUNCTION medwise.create_consignment(
  p_org_id INTEGER,
  p_branch_id INTEGER,
  p_customer_id INTEGER,
  p_customer_name TEXT,
  p_month INTEGER,
  p_year INTEGER,
  p_items JSONB,
  p_created_by TEXT
) RETURNS JSON AS $$
DECLARE
  v_consignment_id BIGINT;
  v_consignment_number TEXT;
  v_item JSONB;
  v_product_id INTEGER;
  v_quantity INTEGER;
  v_price DECIMAL(10,2);
  v_stock RECORD;
  v_qty_to_deduct INTEGER;
  v_deduct_qty INTEGER;
  v_previous_consignment RECORD;
  v_previous_item RECORD;
  v_new_items_qty INTEGER := 0;
  v_previous_balance_qty INTEGER := 0;
  v_total_value DECIMAL(10,2) := 0;
BEGIN
  -- Generate consignment number
  v_consignment_number := medwise.generate_consignment_number();
  
  -- Check for previous month's consignment
  SELECT * INTO v_previous_consignment
  FROM medwise.consignments
  WHERE customer_id = p_customer_id
    AND branch_id = p_branch_id
    AND (
      (year = p_year AND month = p_month - 1) OR
      (month = 12 AND year = p_year - 1 AND p_month = 1)
    )
    AND status = 'active';
  
  -- Get previous balance if exists
  IF v_previous_consignment.id IS NOT NULL THEN
    v_previous_balance_qty := v_previous_consignment.current_balance_qty;
  END IF;
  
  -- Calculate new items quantity
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_new_items_qty := v_new_items_qty + (v_item->>'quantity')::INTEGER;
  END LOOP;
  
  -- Create consignment record
  INSERT INTO medwise.consignments (
    org_id,
    branch_id,
    customer_id,
    customer_name,
    consignment_number,
    month,
    year,
    status,
    previous_balance_qty,
    new_items_qty,
    current_balance_qty,
    created_by
  ) VALUES (
    p_org_id,
    p_branch_id,
    p_customer_id,
    p_customer_name,
    v_consignment_number,
    p_month,
    p_year,
    'active',
    v_previous_balance_qty,
    v_new_items_qty,
    v_previous_balance_qty + v_new_items_qty,
    p_created_by
  ) RETURNING id INTO v_consignment_id;
  
  -- Copy previous month's balance items
  IF v_previous_consignment.id IS NOT NULL THEN
    INSERT INTO medwise.consignment_items (
      consignment_id,
      product_id,
      product_stock_id,
      batch_no,
      date_manufactured,
      expiration_date,
      previous_balance,
      current_balance,
      unit_price,
      total_value
    )
    SELECT 
      v_consignment_id,
      product_id,
      product_stock_id,
      batch_no,
      date_manufactured,
      expiration_date,
      current_balance, -- becomes previous balance
      current_balance, -- initial current balance
      unit_price,
      current_balance * unit_price
    FROM medwise.consignment_items
    WHERE consignment_id = v_previous_consignment.id
      AND current_balance > 0;
  END IF;
  
  -- Process each new item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::INTEGER;
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_price := (v_item->>'price')::DECIMAL(10,2);
    v_qty_to_deduct := v_quantity;
    
    -- Deduct from inventory using FIFO
    FOR v_stock IN
      SELECT *
      FROM medwise.product_stocks
      WHERE product_id = v_product_id
        AND branch_id = p_branch_id
        AND remaining_quantity > 0
        AND expiration_date >= CURRENT_DATE
      ORDER BY date_manufactured ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_qty_to_deduct <= 0;
      
      v_deduct_qty := LEAST(v_stock.remaining_quantity, v_qty_to_deduct);
      
      -- Check if this product already exists in consignment (from previous balance)
      SELECT * INTO v_previous_item
      FROM medwise.consignment_items
      WHERE consignment_id = v_consignment_id
        AND product_id = v_product_id
        AND product_stock_id = v_stock.id;
      
      IF v_previous_item.id IS NOT NULL THEN
        -- Update existing item
        UPDATE medwise.consignment_items
        SET 
          quantity_added = quantity_added + v_deduct_qty,
          current_balance = current_balance + v_deduct_qty,
          total_value = (current_balance + v_deduct_qty) * unit_price,
          updated_at = NOW()
        WHERE id = v_previous_item.id;
      ELSE
        -- Insert new item
        INSERT INTO medwise.consignment_items (
          consignment_id,
          product_id,
          product_stock_id,
          batch_no,
          date_manufactured,
          expiration_date,
          quantity_added,
          current_balance,
          unit_price,
          total_value
        ) VALUES (
          v_consignment_id,
          v_product_id,
          v_stock.id,
          v_stock.batch_no,
          v_stock.date_manufactured,
          v_stock.expiration_date,
          v_deduct_qty,
          v_deduct_qty,
          v_price,
          v_deduct_qty * v_price
        );
      END IF;
      
      -- Update stock: move to consigned_quantity
      UPDATE medwise.product_stocks
      SET 
        remaining_quantity = remaining_quantity - v_deduct_qty,
        consigned_quantity = COALESCE(consigned_quantity, 0) + v_deduct_qty
      WHERE id = v_stock.id;
      
      v_qty_to_deduct := v_qty_to_deduct - v_deduct_qty;
      v_total_value := v_total_value + (v_deduct_qty * v_price);
    END LOOP;
    
    -- Check if enough stock
    IF v_qty_to_deduct > 0 THEN
      RAISE EXCEPTION 'Insufficient stock for product ID %. Required: %, Available: %', 
        v_product_id, v_quantity, v_quantity - v_qty_to_deduct;
    END IF;
  END LOOP;
  
  -- Update consignment totals
  UPDATE medwise.consignments
  SET total_consigned_value = v_total_value
  WHERE id = v_consignment_id;
  
  -- Log history
  INSERT INTO medwise.consignment_history (
    consignment_id,
    action_type,
    notes,
    created_by
  ) VALUES (
    v_consignment_id,
    'created',
    'Consignment created with ' || v_new_items_qty || ' new items',
    p_created_by
  );
  
  -- Return success
  RETURN json_build_object(
    'success', true,
    'consignment_id', v_consignment_id,
    'consignment_number', v_consignment_number,
    'message', 'Consignment created successfully'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Consignment creation failed: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Record Sale from Consignment
-- =====================================================
CREATE OR REPLACE FUNCTION medwise.record_consignment_sale(
  p_consignment_id BIGINT,
  p_items JSONB, -- [{product_id, quantity, price}]
  p_transaction_number TEXT,
  p_payment_type TEXT,
  p_payment_status TEXT,
  p_created_by TEXT
) RETURNS JSON AS $$
DECLARE
  v_consignment RECORD;
  v_item JSONB;
  v_consignment_item RECORD;
  v_transaction_id BIGINT;
  v_total_amount DECIMAL(10,2) := 0;
  v_quantity INTEGER;
  v_price DECIMAL(10,2);
  v_product_id INTEGER;
BEGIN
  -- Get consignment
  SELECT * INTO v_consignment
  FROM medwise.consignments
  WHERE id = p_consignment_id
  FOR UPDATE;
  
  IF v_consignment.id IS NULL THEN
    RAISE EXCEPTION 'Consignment not found';
  END IF;
  
  -- Calculate total
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_price := (v_item->>'price')::DECIMAL(10,2);
    v_total_amount := v_total_amount + (v_quantity * v_price);
  END LOOP;
  
  -- Create transaction record
  INSERT INTO medwise.transactions (
    org_id,
    branch_id,
    customer_id,
    customer_name,
    transaction_number,
    transaction_type,
    payment_type,
    payment_status,
    total_amount,
    status
  ) VALUES (
    v_consignment.org_id,
    v_consignment.branch_id,
    v_consignment.customer_id,
    v_consignment.customer_name,
    p_transaction_number,
    'consignment_sale',
    p_payment_type,
    p_payment_status,
    v_total_amount,
    'completed'
  ) RETURNING id INTO v_transaction_id;
  
  -- Process each sold item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::INTEGER;
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_price := (v_item->>'price')::DECIMAL(10,2);
    
    -- Get consignment item (FIFO - oldest first)
    SELECT * INTO v_consignment_item
    FROM medwise.consignment_items
    WHERE consignment_id = p_consignment_id
      AND product_id = v_product_id
      AND current_balance > 0
    ORDER BY date_manufactured ASC
    LIMIT 1
    FOR UPDATE;
    
    IF v_consignment_item.id IS NULL OR v_consignment_item.current_balance < v_quantity THEN
      RAISE EXCEPTION 'Insufficient consigned quantity for product ID %', v_product_id;
    END IF;
    
    -- Update consignment item
    UPDATE medwise.consignment_items
    SET 
      quantity_sold = quantity_sold + v_quantity,
      current_balance = current_balance - v_quantity,
      transaction_id = v_transaction_id,
      updated_at = NOW()
    WHERE id = v_consignment_item.id;
    
    -- Deduct from consigned_quantity in stock
    UPDATE medwise.product_stocks
    SET consigned_quantity = COALESCE(consigned_quantity, 0) - v_quantity
    WHERE id = v_consignment_item.product_stock_id;
    
    -- Create transaction item
    INSERT INTO medwise.transaction_items (
      transaction_id,
      product_id,
      product_stock_id,
      batch_no,
      date_manufactured,
      expiration_date,
      quantity,
      price,
      total
    ) VALUES (
      v_transaction_id,
      v_product_id,
      v_consignment_item.product_stock_id,
      v_consignment_item.batch_no,
      v_consignment_item.date_manufactured,
      v_consignment_item.expiration_date,
      v_quantity,
      v_price,
      v_quantity * v_price
    );
  END LOOP;
  
  -- Update consignment totals
  UPDATE medwise.consignments
  SET 
    sold_qty = sold_qty + (SELECT SUM((item->>'quantity')::INTEGER) FROM jsonb_array_elements(p_items) item),
    current_balance_qty = current_balance_qty - (SELECT SUM((item->>'quantity')::INTEGER) FROM jsonb_array_elements(p_items) item),
    total_sold_value = total_sold_value + v_total_amount,
    balance_due = balance_due + v_total_amount,
    updated_at = NOW()
  WHERE id = p_consignment_id;
  
  -- Log history
  INSERT INTO medwise.consignment_history (
    consignment_id,
    action_type,
    amount,
    notes,
    created_by
  ) VALUES (
    p_consignment_id,
    'sale_recorded',
    v_total_amount,
    'Sale recorded - Transaction: ' || p_transaction_number,
    p_created_by
  );
  
  RETURN json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'transaction_number', p_transaction_number,
    'message', 'Sale recorded successfully'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Failed to record sale: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Return Items from Consignment
-- =====================================================
CREATE OR REPLACE FUNCTION medwise.return_consignment_items(
  p_consignment_id BIGINT,
  p_items JSONB, -- [{product_id, product_stock_id, quantity}]
  p_created_by TEXT
) RETURNS JSON AS $$
DECLARE
  v_item JSONB;
  v_product_id INTEGER;
  v_product_stock_id BIGINT;
  v_quantity INTEGER;
  v_consignment_item RECORD;
  v_total_returned INTEGER := 0;
BEGIN
  -- Process each returned item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::INTEGER;
    v_product_stock_id := (v_item->>'product_stock_id')::BIGINT;
    v_quantity := (v_item->>'quantity')::INTEGER;
    
    -- Get consignment item
    SELECT * INTO v_consignment_item
    FROM medwise.consignment_items
    WHERE consignment_id = p_consignment_id
      AND product_id = v_product_id
      AND product_stock_id = v_product_stock_id
    FOR UPDATE;
    
    IF v_consignment_item.id IS NULL OR v_consignment_item.current_balance < v_quantity THEN
      RAISE EXCEPTION 'Invalid return quantity for product ID %', v_product_id;
    END IF;
    
    -- Update consignment item
    UPDATE medwise.consignment_items
    SET 
      quantity_returned = quantity_returned + v_quantity,
      current_balance = current_balance - v_quantity,
      updated_at = NOW()
    WHERE id = v_consignment_item.id;
    
    -- Return to inventory
    UPDATE medwise.product_stocks
    SET 
      remaining_quantity = remaining_quantity + v_quantity,
      consigned_quantity = COALESCE(consigned_quantity, 0) - v_quantity
    WHERE id = v_product_stock_id;
    
    v_total_returned := v_total_returned + v_quantity;
  END LOOP;
  
  -- Update consignment totals
  UPDATE medwise.consignments
  SET 
    returned_qty = returned_qty + v_total_returned,
    current_balance_qty = current_balance_qty - v_total_returned,
    updated_at = NOW()
  WHERE id = p_consignment_id;
  
  -- Log history
  INSERT INTO medwise.consignment_history (
    consignment_id,
    action_type,
    quantity,
    notes,
    created_by
  ) VALUES (
    p_consignment_id,
    'items_returned',
    v_total_returned,
    v_total_returned || ' items returned to inventory',
    p_created_by
  );
  
  RETURN json_build_object(
    'success', true,
    'message', v_total_returned || ' items returned successfully'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Failed to return items: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION medwise.generate_consignment_number TO authenticated;
GRANT EXECUTE ON FUNCTION medwise.create_consignment TO authenticated;
GRANT EXECUTE ON FUNCTION medwise.record_consignment_sale TO authenticated;
GRANT EXECUTE ON FUNCTION medwise.return_consignment_items TO authenticated;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE ON medwise.consignments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON medwise.consignment_items TO authenticated;
GRANT SELECT, INSERT ON medwise.consignment_history TO authenticated;
GRANT USAGE ON SEQUENCE medwise.consignments_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE medwise.consignment_items_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE medwise.consignment_history_id_seq TO authenticated;
