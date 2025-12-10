-- =====================================================
-- ADD GL PAYMENT FIELDS TO TRANSACTIONS
-- =====================================================
-- Adds billing_agency and beneficiary_name fields for GL payment method

-- Add new columns to transactions table
ALTER TABLE medwise.transactions
ADD COLUMN IF NOT EXISTS billing_agency TEXT,
ADD COLUMN IF NOT EXISTS beneficiary_name TEXT;

-- Update the create_transaction_with_stock_deduction function to accept new parameters
CREATE OR REPLACE FUNCTION medwise.create_transaction_with_stock_deduction(
  p_org_id INTEGER,
  p_customer_id INTEGER,
  p_customer_name TEXT,
  p_transaction_number TEXT,
  p_transaction_type TEXT,
  p_payment_type TEXT,
  p_payment_status TEXT,
  p_total_amount DECIMAL(10,2),
  p_gl_number TEXT,
  p_billing_agency TEXT,
  p_beneficiary_name TEXT,
  p_branch_id INTEGER,
  p_items JSONB
) RETURNS JSON AS $$
DECLARE
  v_transaction_id BIGINT;
  v_item JSONB;
  v_product_id INTEGER;
  v_quantity INTEGER;
  v_price DECIMAL(10,2);
  v_qty_to_deduct INTEGER;
  v_stock RECORD;
  v_deduct_qty INTEGER;
  v_result JSON;
BEGIN
  -- Start transaction (implicit in function)
  
  -- 1️⃣ Insert transaction record
  INSERT INTO medwise.transactions (
    org_id,
    customer_id,
    customer_name,
    transaction_number,
    transaction_type,
    payment_type,
    payment_status,
    total_amount,
    gl_number,
    billing_agency,
    beneficiary_name,
    branch_id,
    status
  ) VALUES (
    p_org_id,
    p_customer_id,
    p_customer_name,
    p_transaction_number,
    p_transaction_type,
    p_payment_type,
    COALESCE(p_payment_status, 'Paid'),
    p_total_amount,
    p_gl_number,
    p_billing_agency,
    p_beneficiary_name,
    p_branch_id,
    'completed'
  ) RETURNING id INTO v_transaction_id;

  -- 2️⃣ Process each item in cart
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::INTEGER;
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_price := (v_item->>'price')::DECIMAL(10,2);
    v_qty_to_deduct := v_quantity;

    -- 3️⃣ Fetch available stocks with row-level locking (FOR UPDATE)
    -- This prevents other transactions from reading/modifying these rows
    FOR v_stock IN
      SELECT *
      FROM medwise.product_stocks
      WHERE product_id = v_product_id
        AND branch_id = p_branch_id
        AND remaining_quantity > 0
        AND expiration_date >= CURRENT_DATE
      ORDER BY date_manufactured ASC  -- FIFO
      FOR UPDATE  -- 🔒 Lock these rows
    LOOP
      EXIT WHEN v_qty_to_deduct <= 0;

      -- Calculate how much to deduct from this batch
      v_deduct_qty := LEAST(v_stock.remaining_quantity, v_qty_to_deduct);

      -- 4️⃣ Insert transaction_item with batch info
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
        v_stock.id,
        v_stock.batch_no,
        v_stock.date_manufactured,
        v_stock.expiration_date,
        v_deduct_qty,
        v_price,
        v_deduct_qty * v_price
      );

      -- 5️⃣ Update stock quantity (or consigned_quantity for consignments)
      IF p_transaction_type = 'consignment' THEN
        UPDATE medwise.product_stocks
        SET 
          remaining_quantity = remaining_quantity - v_deduct_qty,
          consigned_quantity = COALESCE(consigned_quantity, 0) + v_deduct_qty
        WHERE id = v_stock.id;
      ELSE
        UPDATE medwise.product_stocks
        SET remaining_quantity = remaining_quantity - v_deduct_qty
        WHERE id = v_stock.id;
      END IF;

      v_qty_to_deduct := v_qty_to_deduct - v_deduct_qty;
    END LOOP;

    -- 6️⃣ Check if we have enough stock
    IF v_qty_to_deduct > 0 THEN
      RAISE EXCEPTION 'Insufficient stock for product ID %. Required: %, Available: %', 
        v_product_id, v_quantity, v_quantity - v_qty_to_deduct;
    END IF;
  END LOOP;

  -- 7️⃣ Return success response with transaction details
  SELECT json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'transaction_number', p_transaction_number,
    'message', 'Transaction completed successfully'
  ) INTO v_result;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Automatic rollback happens here
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Transaction failed: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION medwise.create_transaction_with_stock_deduction TO authenticated;
