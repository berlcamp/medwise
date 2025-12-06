-- =====================================================
-- FUNCTION: Add Items to Existing Consignment
-- =====================================================
-- This function allows adding new products or increasing
-- quantities of existing products in an existing consignment
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
  
  -- Process each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::INTEGER;
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_price := (v_item->>'price')::DECIMAL(10,2);
    v_qty_to_deduct := v_quantity;
    
    -- Check if product already exists in consignment
    -- We need to find an existing item for the same product to potentially merge
    -- But we'll create separate items per stock batch (FIFO)
    
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
        );
      END IF;
      
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
    'total_value', v_total_value
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION medwise.add_consignment_items TO authenticated;