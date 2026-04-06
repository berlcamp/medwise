-- =====================================================
-- UPDATE: create_consignment
-- Changes:
-- 1. Close previous consignment when creating a new one
-- 2. Include previous balance value in total_consigned_value
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
  v_previous_balance_value DECIMAL(10,2) := 0;
  v_total_value DECIMAL(10,2) := 0;
  v_transaction_number TEXT;
  v_consignment_transaction_id BIGINT;
  v_consignment_item RECORD;
BEGIN
  -- Generate consignment and transaction numbers
  v_consignment_number := medwise.generate_consignment_number();
  v_transaction_number := medwise.generate_transaction_number(p_branch_id, 'consignment_add');

  -- Find the most recent active consignment for this customer (not limited to previous month)
  SELECT * INTO v_previous_consignment
  FROM medwise.consignments
  WHERE customer_id = p_customer_id
    AND branch_id = p_branch_id
    AND status = 'active'
    AND (year < p_year OR (year = p_year AND month < p_month))
  ORDER BY year DESC, month DESC
  LIMIT 1;

  -- Get previous balance if exists
  IF v_previous_consignment.id IS NOT NULL THEN
    v_previous_balance_qty := v_previous_consignment.current_balance_qty;

    -- Calculate previous balance value from unsold items
    SELECT COALESCE(SUM(current_balance * unit_price), 0) INTO v_previous_balance_value
    FROM medwise.consignment_items
    WHERE consignment_id = v_previous_consignment.id
      AND current_balance > 0;
  END IF;

  -- Calculate new items quantity and total value
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_new_items_qty := v_new_items_qty + (v_item->>'quantity')::INTEGER;
    v_total_value := v_total_value + ((v_item->>'quantity')::INTEGER * (v_item->>'price')::DECIMAL(10,2));
  END LOOP;

  -- Create consignment record (total_consigned_value includes previous balance value + new items value)
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
    v_previous_balance_value + v_total_value,
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

    -- Close previous consignment
    UPDATE medwise.consignments
    SET status = 'closed', updated_at = NOW()
    WHERE id = v_previous_consignment.id;

    -- Log closure in history
    INSERT INTO medwise.consignment_history (
      consignment_id,
      action_type,
      notes,
      created_by
    ) VALUES (
      v_previous_consignment.id,
      'closed',
      'Closed - balance carried forward to ' || v_consignment_number,
      p_created_by
    );
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
