-- =====================================================
-- UPDATE: record_agent_sale function to accept customer
-- =====================================================
-- This migration updates the record_agent_sale function
-- to accept customer_id and customer_name parameters
-- instead of hardcoding the agent as the customer

CREATE OR REPLACE FUNCTION medwise.record_agent_sale(
  p_agent_id BIGINT,
  p_customer_id INTEGER,
  p_customer_name TEXT,
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
  
  -- Create transaction record with customer information
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
    p_customer_id,
    p_customer_name,
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
