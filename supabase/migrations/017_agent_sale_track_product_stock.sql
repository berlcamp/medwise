-- =====================================================
-- AGENT SALE COST TRACKING
-- =====================================================
-- 1. record_agent_sale now stores product_stock_id on each transaction_item
--    so the Profit report can resolve batch purchase cost.
-- 2. One-time backfill of product_stock_id for existing agent_sale lines,
--    matched via batch_no -> product_stocks. This field is read ONLY by the
--    Profit report cost lookup; it drives no stock/return/void/money logic,
--    so the backfill cannot affect inventory or financial records.
--
-- PRE-CHECK (run manually BEFORE applying; not executed by this migration):
--   SELECT
--     count(*) FILTER (WHERE ps.id IS NOT NULL) AS will_backfill,
--     count(*) FILTER (WHERE ps.id IS NULL)     AS wont_match,
--     count(*) FILTER (WHERE ti.batch_no IS NULL) AS no_batch_no
--   FROM medwise.transaction_items ti
--   JOIN medwise.transactions t ON t.id = ti.transaction_id
--   LEFT JOIN LATERAL (
--     SELECT ps.id FROM medwise.product_stocks ps
--     WHERE ps.product_id = ti.product_id
--       AND ps.batch_no  = ti.batch_no
--       AND ps.branch_id = t.branch_id
--     ORDER BY ps.id LIMIT 1
--   ) ps ON true
--   WHERE t.transaction_type = 'agent_sale'
--     AND ti.product_stock_id IS NULL;

-- 1️⃣ Redefine record_agent_sale (adds product_stock_id to the item INSERT)
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
  SELECT * INTO v_agent
  FROM medwise.agents
  WHERE id = p_agent_id
  FOR UPDATE;

  IF v_agent.id IS NULL THEN
    RAISE EXCEPTION 'Agent not found';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_price := (v_item->>'price')::DECIMAL(10,2);
    v_total_amount := v_total_amount + (v_quantity * v_price);
  END LOOP;

  INSERT INTO medwise.transactions (
    org_id, branch_id, customer_id, customer_name, transaction_number,
    transaction_type, payment_type, payment_status, total_amount, status
  ) VALUES (
    v_agent.org_id, v_agent.branch_id, p_customer_id, p_customer_name,
    p_transaction_number, 'agent_sale', p_payment_type, p_payment_status,
    v_total_amount, 'completed'
  ) RETURNING id INTO v_transaction_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::INTEGER;
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_price := (v_item->>'price')::DECIMAL(10,2);

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

    -- product_stock_id added here so cost can be resolved later
    INSERT INTO medwise.transaction_items (
      transaction_id, product_id, product_stock_id, quantity, price, total,
      batch_no, expiration_date
    ) VALUES (
      v_transaction_id, v_product_id, v_agent_item.product_stock_id,
      v_quantity, v_price, v_quantity * v_price,
      v_agent_item.batch_no, v_agent_item.expiration_date
    );

    UPDATE medwise.agent_items
    SET quantity_sold = quantity_sold + v_quantity,
        current_balance = current_balance - v_quantity,
        transaction_id = v_transaction_id,
        updated_at = NOW()
    WHERE id = v_agent_item.id;
  END LOOP;

  INSERT INTO medwise.agent_history (
    agent_id, action_type, amount, notes, created_by
  ) VALUES (
    p_agent_id, 'sale_recorded', v_total_amount,
    'Sale recorded - Transaction: ' || p_transaction_number, p_created_by
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

GRANT EXECUTE ON FUNCTION medwise.record_agent_sale TO authenticated;

-- 2️⃣ One-time backfill for historical agent_sale lines (null-only, reversible)
UPDATE medwise.transaction_items ti
SET product_stock_id = (
  SELECT ps.id
  FROM medwise.product_stocks ps
  JOIN medwise.transactions t ON t.id = ti.transaction_id
  WHERE ps.product_id = ti.product_id
    AND ps.batch_no  = ti.batch_no
    AND ps.branch_id = t.branch_id
  ORDER BY ps.id
  LIMIT 1
)
WHERE ti.product_stock_id IS NULL
  AND ti.batch_no IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM medwise.transactions t
    WHERE t.id = ti.transaction_id
      AND t.transaction_type = 'agent_sale'
  );
