-- =====================================================
-- LINK CONSIGNMENT SALES TO THEIR CONSIGNMENT
-- =====================================================
-- Collections on a consignment are recorded against the consignment itself
-- (`consignment_payments`, migration 022), never against the individual
-- `consignment_sale` transactions — those are inserted with payment_status
-- 'Pending' and nothing ever updates them. So every report that buckets money
-- by `transactions.payment_status` showed consignment sales as permanently
-- unpaid, and filtering the sales report by "Paid" returned nothing even for
-- consignments that were fully collected.
--
-- There was also no way to walk from a sale back to the consignment that owns
-- it: `consignment_items.transaction_id` only remembers the most recent sale
-- per item. This adds the real link so the reports can read the status off the
-- consignment ledger.

ALTER TABLE medwise.transactions
  ADD COLUMN IF NOT EXISTS consignment_id BIGINT
    REFERENCES medwise.consignments(id) ON DELETE SET NULL;

COMMENT ON COLUMN medwise.transactions.consignment_id IS 'For consignment_sale transactions: the consignment the sale was recorded against. Payment status for these lives on that consignment, not on this row.';

CREATE INDEX IF NOT EXISTS idx_transactions_consignment
  ON medwise.transactions(consignment_id);

-- -----------------------------------------------------
-- Record the link on every new sale
-- -----------------------------------------------------
-- Same body as migration 002, with `consignment_id` added to the transaction
-- insert.
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
    status,
    consignment_id
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
    'completed',
    p_consignment_id
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

-- -----------------------------------------------------
-- Backfill the sales recorded before this migration
-- -----------------------------------------------------
-- 1️⃣ Exact link, where the sold item still points at its sale transaction.
UPDATE medwise.transactions t
SET consignment_id = ci.consignment_id
FROM (
  SELECT DISTINCT ON (transaction_id) transaction_id, consignment_id
  FROM medwise.consignment_items
  WHERE transaction_id IS NOT NULL
  ORDER BY transaction_id, updated_at DESC
) ci
WHERE t.id = ci.transaction_id
  AND t.transaction_type = 'consignment_sale'
  AND t.consignment_id IS NULL;

-- 2️⃣ Older sales, where a later sale overwrote consignment_items.transaction_id:
--    match the customer's consignment for the month the sale was recorded in.
--    Sales that match no consignment stay NULL and keep reporting off their own
--    payment_status.
UPDATE medwise.transactions t
SET consignment_id = (
  SELECT c.id
  FROM medwise.consignments c
  WHERE c.customer_id = t.customer_id
    AND c.branch_id = t.branch_id
    AND c.year = EXTRACT(YEAR FROM t.created_at)::INTEGER
    AND c.month = EXTRACT(MONTH FROM t.created_at)::INTEGER
  ORDER BY c.created_at DESC
  LIMIT 1
)
WHERE t.transaction_type = 'consignment_sale'
  AND t.consignment_id IS NULL
  AND t.customer_id IS NOT NULL
  AND t.branch_id IS NOT NULL;

GRANT EXECUTE ON FUNCTION medwise.record_consignment_sale TO authenticated;
