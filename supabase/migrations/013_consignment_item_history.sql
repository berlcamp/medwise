-- =====================================================
-- CONSIGNMENT ITEM HISTORY (ADDITIONS) WITHOUT TRANSACTIONS TABLE
-- =====================================================
-- Creates dedicated tables for consignment item additions and updates
-- create_consignment / add_consignment_items to write into them instead
-- of the generic transactions/transaction_items tables.

-- =====================================================
-- UPDATE: Transaction number generation (add type prefix)
-- =====================================================
DROP FUNCTION IF EXISTS medwise.generate_transaction_number();
DROP FUNCTION IF EXISTS medwise.generate_transaction_number(INTEGER);

CREATE OR REPLACE FUNCTION medwise.generate_transaction_number(
  p_branch_id INTEGER,
  p_transaction_type TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  v_today_prefix TEXT;
  v_last_number TEXT;
  v_next_sequence INTEGER;
  v_last_seq INTEGER;
BEGIN
  v_today_prefix := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

  -- Get last transaction number for today, this branch, and this transaction type
  -- This ensures each transaction type has its own separate numbering series
  SELECT transaction_number INTO v_last_number
  FROM medwise.transactions
  WHERE transaction_number LIKE v_today_prefix || '-%'
    AND branch_id = p_branch_id
    AND (p_transaction_type IS NULL OR transaction_type = p_transaction_type)
  -- Handles both legacy (YYYYMMDD-type-#) and new (YYYYMMDD-#) formats
  ORDER BY (
    COALESCE(
      (regexp_match(transaction_number, '-([0-9]+)$'))[1]::INTEGER,
      0
    )
  ) DESC
  LIMIT 1;

  IF v_last_number IS NULL THEN
    v_next_sequence := 1;
  ELSE
    v_last_seq := COALESCE(
      (regexp_match(v_last_number, '-([0-9]+)$'))[1]::INTEGER,
      0
    );
    v_next_sequence := v_last_seq + 1;
  END IF;

  RETURN v_today_prefix || '-' || v_next_sequence;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION medwise.generate_transaction_number(INTEGER, TEXT) TO authenticated;

-- =====================================================
-- TABLE: consignment_item_transactions
-- =====================================================
CREATE TABLE IF NOT EXISTS medwise.consignment_item_transactions (
  id BIGSERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  branch_id INTEGER NOT NULL,
  consignment_id BIGINT NOT NULL REFERENCES medwise.consignments(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES medwise.customers(id),
  customer_name TEXT,
  transaction_number TEXT NOT NULL,
  transaction_type TEXT NOT NULL DEFAULT 'consignment_add',
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cons_item_tx_consignment_id
  ON medwise.consignment_item_transactions(consignment_id);
CREATE INDEX IF NOT EXISTS idx_cons_item_tx_customer_id
  ON medwise.consignment_item_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_cons_item_tx_branch_id
  ON medwise.consignment_item_transactions(branch_id);

-- =====================================================
-- TABLE: consignment_item_transaction_items
-- =====================================================
CREATE TABLE IF NOT EXISTS medwise.consignment_item_transaction_items (
  id BIGSERIAL PRIMARY KEY,
  consignment_transaction_id BIGINT NOT NULL REFERENCES medwise.consignment_item_transactions(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES medwise.products(id),
  product_stock_id INTEGER REFERENCES medwise.product_stocks(id),
  batch_no TEXT,
  date_manufactured DATE,
  expiration_date DATE,
  quantity INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  total DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cons_item_tx_items_tx_id
  ON medwise.consignment_item_transaction_items(consignment_transaction_id);
CREATE INDEX IF NOT EXISTS idx_cons_item_tx_items_product_id
  ON medwise.consignment_item_transaction_items(product_id);

-- Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON medwise.consignment_item_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON medwise.consignment_item_transaction_items TO authenticated;

-- =====================================================
-- UPDATE: create_consignment (stop writing to transactions table)
-- =====================================================
CREATE OR REPLACE FUNCTION medwise.create_consignment(
  p_org_id INTEGER,
  p_branch_id INTEGER,
  p_customer_id INTEGER,
  p_customer_name TEXT,
  p_month INTEGER,
  p_year INTEGER,
  p_items JSONB, -- [{product_id, quantity, price}]
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
  v_transaction_number TEXT;
  v_consignment_transaction_id BIGINT;
  v_consignment_item RECORD;
BEGIN
  -- Generate consignment and transaction numbers
  v_consignment_number := medwise.generate_consignment_number();
  v_transaction_number := medwise.generate_transaction_number(p_branch_id, 'consignment_add');
  
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
  
  -- Calculate new items quantity and total value
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_new_items_qty := v_new_items_qty + (v_item->>'quantity')::INTEGER;
    v_total_value := v_total_value + ((v_item->>'quantity')::INTEGER * (v_item->>'price')::DECIMAL(10,2));
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
    total_consigned_value,
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
    v_total_value,
    p_created_by
  ) RETURNING id INTO v_consignment_id;
  
  -- Create consignment add transaction record (for printing/history)
  INSERT INTO medwise.consignment_item_transactions (
    org_id,
    branch_id,
    consignment_id,
    customer_id,
    customer_name,
    transaction_number,
    transaction_type,
    total_amount,
    created_by
  ) VALUES (
    p_org_id,
    p_branch_id,
    v_consignment_id,
    p_customer_id,
    p_customer_name,
    v_transaction_number,
    'consignment_add',
    v_total_value,
    p_created_by
  ) RETURNING id INTO v_consignment_transaction_id;
  
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
      current_balance,
      current_balance,
      unit_price,
      total_value
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
        
        v_consignment_item := v_previous_item;
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
        ) RETURNING * INTO v_consignment_item;
      END IF;
      
      -- Create consignment transaction item (for history/printing)
      INSERT INTO medwise.consignment_item_transaction_items (
        consignment_transaction_id,
        product_id,
        product_stock_id,
        batch_no,
        date_manufactured,
        expiration_date,
        quantity,
        price,
        total
      ) VALUES (
        v_consignment_transaction_id,
        v_product_id,
        v_stock.id,
        v_stock.batch_no,
        v_stock.date_manufactured,
        v_stock.expiration_date,
        v_deduct_qty,
        v_price,
        v_deduct_qty * v_price
      );
      
      -- Update stock: move to consigned_quantity
      UPDATE medwise.product_stocks
      SET 
        remaining_quantity = remaining_quantity - v_deduct_qty,
        consigned_quantity = COALESCE(consigned_quantity, 0) + v_deduct_qty
      WHERE id = v_stock.id;
      
      v_qty_to_deduct := v_qty_to_deduct - v_deduct_qty;
    END LOOP;
    
    -- Check if enough stock
    IF v_qty_to_deduct > 0 THEN
      RAISE EXCEPTION 'Insufficient stock for product ID %. Required: %, Available: %', 
        v_product_id, v_quantity, v_quantity - v_qty_to_deduct;
    END IF;
  END LOOP;
  
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
    'consignment_transaction_id', v_consignment_transaction_id,
    'transaction_number', v_transaction_number,
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
-- UPDATE: add_consignment_items (stop writing to transactions table)
-- =====================================================
CREATE OR REPLACE FUNCTION medwise.add_consignment_items(
  p_consignment_id BIGINT,
  p_items JSONB, -- [{product_id, quantity, price}]
  p_created_by TEXT
) RETURNS JSON AS $$
DECLARE
  v_consignment RECORD;
  v_item JSONB;
  v_product_id INTEGER;
  v_quantity INTEGER;
  v_price DECIMAL(10,2);
  v_stock RECORD;
  v_qty_to_deduct INTEGER;
  v_deduct_qty INTEGER;
  v_existing_item RECORD;
  v_total_value DECIMAL(10,2) := 0;
  v_new_items_qty INTEGER := 0;
  v_items_added INTEGER := 0;
  v_transaction_number TEXT;
  v_consignment_transaction_id BIGINT;
  v_consignment_item RECORD;
BEGIN
  -- Get consignment with lock
  SELECT * INTO v_consignment
  FROM medwise.consignments
  WHERE id = p_consignment_id
  FOR UPDATE;
  
  IF v_consignment.id IS NULL THEN
    RAISE EXCEPTION 'Consignment not found';
  END IF;

  IF v_consignment.status != 'active' THEN
    RAISE EXCEPTION 'Cannot add items to inactive consignment';
  END IF;
  
  -- Generate transaction number
  v_transaction_number := medwise.generate_transaction_number(v_consignment.branch_id, 'consignment_add');
  
  -- Calculate total value first
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_total_value := v_total_value + ((v_item->>'quantity')::INTEGER * (v_item->>'price')::DECIMAL(10,2));
  END LOOP;
  
  -- Create consignment add transaction header
  INSERT INTO medwise.consignment_item_transactions (
    org_id,
    branch_id,
    consignment_id,
    customer_id,
    customer_name,
    transaction_number,
    transaction_type,
    total_amount,
    created_by
  ) VALUES (
    v_consignment.org_id,
    v_consignment.branch_id,
    v_consignment.id,
    v_consignment.customer_id,
    v_consignment.customer_name,
    v_transaction_number,
    'consignment_add',
    v_total_value,
    p_created_by
  ) RETURNING id INTO v_consignment_transaction_id;
  
  -- Reset total value for recalculation during processing
  v_total_value := 0;
  
  -- Process each item
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
        AND branch_id = v_consignment.branch_id
        AND remaining_quantity > 0
        AND expiration_date >= CURRENT_DATE
      ORDER BY date_manufactured ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_qty_to_deduct <= 0;
      
      v_deduct_qty := LEAST(v_stock.remaining_quantity, v_qty_to_deduct);
      
      -- Check if this product+stock combination already exists in consignment
      SELECT * INTO v_existing_item
      FROM medwise.consignment_items
      WHERE consignment_id = p_consignment_id
        AND product_id = v_product_id
        AND product_stock_id = v_stock.id;
      
      IF v_existing_item.id IS NOT NULL THEN
        -- Update existing item - add quantity
        UPDATE medwise.consignment_items
        SET 
          quantity_added = quantity_added + v_deduct_qty,
          current_balance = current_balance + v_deduct_qty,
          total_value = (current_balance + v_deduct_qty) * unit_price,
          updated_at = NOW()
        WHERE id = v_existing_item.id;
        
        v_consignment_item := v_existing_item;
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
          p_consignment_id,
          v_product_id,
          v_stock.id,
          v_stock.batch_no,
          v_stock.date_manufactured,
          v_stock.expiration_date,
          v_deduct_qty,
          v_deduct_qty,
          v_price,
          v_deduct_qty * v_price
        ) RETURNING * INTO v_consignment_item;
      END IF;
      
      -- Create consignment transaction item
      INSERT INTO medwise.consignment_item_transaction_items (
        consignment_transaction_id,
        product_id,
        product_stock_id,
        batch_no,
        date_manufactured,
        expiration_date,
        quantity,
        price,
        total
      ) VALUES (
        v_consignment_transaction_id,
        v_product_id,
        v_stock.id,
        v_stock.batch_no,
        v_stock.date_manufactured,
        v_stock.expiration_date,
        v_deduct_qty,
        v_price,
        v_deduct_qty * v_price
      );
      
      -- Update stock: move from remaining_quantity to consigned_quantity
      UPDATE medwise.product_stocks
      SET 
        remaining_quantity = remaining_quantity - v_deduct_qty,
        consigned_quantity = COALESCE(consigned_quantity, 0) + v_deduct_qty
      WHERE id = v_stock.id;
      
      v_qty_to_deduct := v_qty_to_deduct - v_deduct_qty;
      v_total_value := v_total_value + (v_deduct_qty * v_price);
      v_items_added := v_items_added + v_deduct_qty;
    END LOOP;
    
    -- Check if enough stock
    IF v_qty_to_deduct > 0 THEN
      RAISE EXCEPTION 'Insufficient stock for product ID %. Required: %, Available: %', 
        v_product_id, v_quantity, v_quantity - v_qty_to_deduct;
    END IF;
  END LOOP;
  
  -- Update transaction total amount with actual calculated value
  UPDATE medwise.consignment_item_transactions
  SET total_amount = v_total_value,
      updated_at = NOW()
  WHERE id = v_consignment_transaction_id;
  
  -- Update consignment totals
  UPDATE medwise.consignments
  SET 
    new_items_qty = new_items_qty + v_items_added,
    current_balance_qty = current_balance_qty + v_items_added,
    total_consigned_value = total_consigned_value + v_total_value,
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
    'items_added',
    v_items_added,
    v_items_added || ' items added to consignment',
    p_created_by
  );
  
  RETURN json_build_object(
    'success', true,
    'message', v_items_added || ' items added successfully',
    'items_added', v_items_added,
    'total_value', v_total_value,
    'consignment_transaction_id', v_consignment_transaction_id,
    'transaction_number', v_transaction_number
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Failed to add items: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (idempotent)
GRANT EXECUTE ON FUNCTION medwise.create_consignment TO authenticated;
GRANT EXECUTE ON FUNCTION medwise.add_consignment_items TO authenticated;
