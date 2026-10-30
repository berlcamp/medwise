-- =====================================================
-- CONSIGNMENT ITEMS: EDIT UNIT PRICE
-- =====================================================
-- Lets a consignment item's unit price be changed after it was consigned.
-- Only the units still with the customer (current_balance) are repriced:
-- sales already recorded keep the price they were sold at, so
-- total_sold_value and balance_due are untouched. total_consigned_value moves
-- by the repriced balance so "consigned - sold" still equals the value of the
-- remaining stock.
-- =====================================================

CREATE OR REPLACE FUNCTION medwise.update_consignment_item_price(
  p_consignment_item_id BIGINT,
  p_price DECIMAL(10,2),
  p_created_by TEXT
) RETURNS JSON AS $$
DECLARE
  v_item RECORD;
  v_value_diff DECIMAL(10,2);
BEGIN
  IF p_price IS NULL OR p_price < 0 THEN
    RAISE EXCEPTION 'Unit price must be zero or greater';
  END IF;

  SELECT * INTO v_item
  FROM medwise.consignment_items
  WHERE id = p_consignment_item_id
  FOR UPDATE;

  IF v_item.id IS NULL THEN
    RAISE EXCEPTION 'Consignment item not found';
  END IF;

  -- Lock the parent so totals stay consistent with concurrent sales/returns
  PERFORM 1 FROM medwise.consignments
  WHERE id = v_item.consignment_id
  FOR UPDATE;

  v_value_diff := (p_price - v_item.unit_price) * v_item.current_balance;

  UPDATE medwise.consignment_items
  SET
    unit_price = p_price,
    total_value = current_balance * p_price,
    updated_at = NOW()
  WHERE id = v_item.id;

  UPDATE medwise.consignments
  SET
    total_consigned_value = total_consigned_value + v_value_diff,
    updated_at = NOW()
  WHERE id = v_item.consignment_id;

  INSERT INTO medwise.consignment_history (
    consignment_id,
    action_type,
    product_id,
    amount,
    notes,
    created_by
  ) VALUES (
    v_item.consignment_id,
    'price_updated',
    v_item.product_id,
    p_price,
    'Unit price changed from ' || v_item.unit_price || ' to ' || p_price
      || COALESCE(' (Batch: ' || v_item.batch_no || ')', ''),
    p_created_by
  );

  RETURN json_build_object(
    'success', true,
    'message', 'Unit price updated'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Failed to update unit price: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION medwise.update_consignment_item_price TO authenticated;
