-- =====================================================
-- AGENT SYSTEM
-- =====================================================
-- Similar to consignments but with continuous tracking (no monthly periods)

-- =====================================================
-- 1. AGENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS medwise.agents (
  id BIGSERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  branch_id INTEGER NOT NULL REFERENCES medwise.branches(id),
  name TEXT NOT NULL,
  area TEXT,
  contact_number TEXT,
  vehicle_plate_number TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active, inactive
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT
);

-- =====================================================
-- 2. AGENT ITEMS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS medwise.agent_items (
  id BIGSERIAL PRIMARY KEY,
  agent_id BIGINT NOT NULL REFERENCES medwise.agents(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES medwise.products(id),
  product_stock_id BIGINT REFERENCES medwise.product_stocks(id),
  
  -- Batch info
  batch_no TEXT,
  expiration_date DATE,
  
  -- Quantities
  quantity_added INTEGER DEFAULT 0,   -- Items given to agent
  quantity_sold INTEGER DEFAULT 0,    -- Items sold by agent
  quantity_returned INTEGER DEFAULT 0, -- Items returned to inventory
  current_balance INTEGER DEFAULT 0,  -- Items still with agent
  
  -- Pricing
  unit_price DECIMAL(10,2) NOT NULL,
  total_value DECIMAL(10,2) NOT NULL,
  
  -- Transaction tracking (when sold)
  transaction_id BIGINT REFERENCES medwise.transactions(id),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 3. AGENT HISTORY TABLE (Activity log)
-- =====================================================
CREATE TABLE IF NOT EXISTS medwise.agent_history (
  id BIGSERIAL PRIMARY KEY,
  agent_id BIGINT NOT NULL REFERENCES medwise.agents(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'created', 'items_added', 'sale_recorded', 'items_returned'
  
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
CREATE INDEX IF NOT EXISTS idx_agents_branch ON medwise.agents(branch_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON medwise.agents(status);
CREATE INDEX IF NOT EXISTS idx_agent_items_agent ON medwise.agent_items(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_items_product ON medwise.agent_items(product_id);
CREATE INDEX IF NOT EXISTS idx_agent_history_agent ON medwise.agent_history(agent_id);

-- =====================================================
-- FUNCTION: Create Agent Assignment
-- =====================================================
CREATE OR REPLACE FUNCTION medwise.create_agent_assignment(
  p_org_id INTEGER,
  p_branch_id INTEGER,
  p_agent_id BIGINT,
  p_items JSONB, -- [{product_id, quantity, price}]
  p_created_by TEXT
) RETURNS JSON AS $$
DECLARE
  v_item JSONB;
  v_product_id INTEGER;
  v_quantity INTEGER;
  v_price DECIMAL(10,2);
  v_qty_to_deduct INTEGER;
  v_deduct_qty INTEGER;
  v_stock RECORD;
  v_total_value DECIMAL(10,2) := 0;
BEGIN
  -- Process each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::INTEGER;
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_price := (v_item->>'price')::DECIMAL(10,2);
    v_qty_to_deduct := v_quantity;

    -- Fetch available stocks with FIFO
    FOR v_stock IN
      SELECT *
      FROM medwise.product_stocks
      WHERE product_id = v_product_id
        AND branch_id = p_branch_id
        AND remaining_quantity > 0
        AND (expiration_date IS NULL OR expiration_date >= CURRENT_DATE)
      ORDER BY date_manufactured ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_qty_to_deduct <= 0;

      v_deduct_qty := LEAST(v_stock.remaining_quantity, v_qty_to_deduct);

      -- Create agent item
      INSERT INTO medwise.agent_items (
        agent_id,
        product_id,
        product_stock_id,
        batch_no,
        expiration_date,
        quantity_added,
        current_balance,
        unit_price,
        total_value
      ) VALUES (
        p_agent_id,
        v_product_id,
        v_stock.id,
        v_stock.batch_no,
        v_stock.expiration_date,
        v_deduct_qty,
        v_deduct_qty,
        v_price,
        v_deduct_qty * v_price
      );

      -- Update stock: move to agent
      UPDATE medwise.product_stocks
      SET remaining_quantity = remaining_quantity - v_deduct_qty
      WHERE id = v_stock.id;

      v_total_value := v_total_value + (v_deduct_qty * v_price);
      v_qty_to_deduct := v_qty_to_deduct - v_deduct_qty;
    END LOOP;

    IF v_qty_to_deduct > 0 THEN
      RAISE EXCEPTION 'Insufficient stock for product ID %. Required: %, Available: %', 
        v_product_id, v_quantity, v_quantity - v_qty_to_deduct;
    END IF;
  END LOOP;

  -- Log history
  INSERT INTO medwise.agent_history (
    agent_id,
    action_type,
    notes,
    created_by
  ) VALUES (
    p_agent_id,
    'items_added',
    'Items assigned to agent',
    p_created_by
  );

  RETURN json_build_object(
    'success', true,
    'message', 'Agent assignment created successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Failed to create agent assignment: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Record Agent Sale
-- =====================================================
CREATE OR REPLACE FUNCTION medwise.record_agent_sale(
  p_agent_id BIGINT,
  p_items JSONB, -- [{product_id, quantity, price}]
  p_transaction_number TEXT,
  p_payment_type TEXT,
  p_payment_status TEXT,
  p_created_by TEXT
) RETURNS JSON AS $$
DECLARE
  v_agent RECORD;
  v_item JSONB;
  v_agent_item RECORD;
  v_transaction_id BIGINT;
  v_total_amount DECIMAL(10,2) := 0;
  v_quantity INTEGER;
  v_price DECIMAL(10,2);
  v_product_id INTEGER;
BEGIN
  -- Get agent
  SELECT * INTO v_agent
  FROM medwise.agents
  WHERE id = p_agent_id
  FOR UPDATE;
  
  IF v_agent.id IS NULL THEN
    RAISE EXCEPTION 'Agent not found';
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
    v_agent.org_id,
    v_agent.branch_id,
    NULL,
    v_agent.name || ' (Agent)',
    p_transaction_number,
    'agent_sale',
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

    -- Find agent item with available balance (FIFO)
    SELECT * INTO v_agent_item
    FROM medwise.agent_items
    WHERE agent_id = p_agent_id
      AND product_id = v_product_id
      AND current_balance > 0
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE;

    IF v_agent_item.id IS NULL THEN
      RAISE EXCEPTION 'No available stock for product ID %', v_product_id;
    END IF;

    -- Create transaction item
    INSERT INTO medwise.transaction_items (
      transaction_id,
      product_id,
      quantity,
      price,
      total,
      batch_no,
      expiration_date
    ) VALUES (
      v_transaction_id,
      v_product_id,
      v_quantity,
      v_price,
      v_quantity * v_price,
      v_agent_item.batch_no,
      v_agent_item.expiration_date
    );

    -- Update agent item
    UPDATE medwise.agent_items
    SET 
      quantity_sold = quantity_sold + v_quantity,
      current_balance = current_balance - v_quantity,
      transaction_id = v_transaction_id,
      updated_at = NOW()
    WHERE id = v_agent_item.id;
  END LOOP;
  
  -- Log history
  INSERT INTO medwise.agent_history (
    agent_id,
    action_type,
    amount,
    notes,
    created_by
  ) VALUES (
    p_agent_id,
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
-- FUNCTION: Return Agent Items
-- =====================================================
CREATE OR REPLACE FUNCTION medwise.return_agent_items(
  p_agent_id BIGINT,
  p_items JSONB, -- [{product_id, product_stock_id, quantity}]
  p_created_by TEXT
) RETURNS JSON AS $$
DECLARE
  v_item JSONB;
  v_product_id INTEGER;
  v_product_stock_id BIGINT;
  v_quantity INTEGER;
  v_agent_item RECORD;
BEGIN
  -- Process each returned item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::INTEGER;
    v_product_stock_id := (v_item->>'product_stock_id')::BIGINT;
    v_quantity := (v_item->>'quantity')::INTEGER;

    -- Find agent item
    SELECT * INTO v_agent_item
    FROM medwise.agent_items
    WHERE agent_id = p_agent_id
      AND product_id = v_product_id
      AND current_balance >= v_quantity
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE;

    IF v_agent_item.id IS NULL THEN
      RAISE EXCEPTION 'Insufficient balance for product ID %', v_product_id;
    END IF;

    -- Return to inventory
    UPDATE medwise.product_stocks
    SET remaining_quantity = remaining_quantity + v_quantity
    WHERE id = v_agent_item.product_stock_id;

    -- Update agent item
    UPDATE medwise.agent_items
    SET 
      quantity_returned = quantity_returned + v_quantity,
      current_balance = current_balance - v_quantity,
      updated_at = NOW()
    WHERE id = v_agent_item.id;
  END LOOP;
  
  -- Log history
  INSERT INTO medwise.agent_history (
    agent_id,
    action_type,
    notes,
    created_by
  ) VALUES (
    p_agent_id,
    'items_returned',
    'Items returned to inventory',
    p_created_by
  );
  
  RETURN json_build_object(
    'success', true,
    'message', 'Items returned successfully'
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
