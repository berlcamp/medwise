-- =====================================================
-- UPDATE TRANSACTION NUMBER GENERATION TO BE BRANCH-SPECIFIC
-- =====================================================
-- This migration updates the generate_transaction_number function
-- to generate transaction numbers per branch, so each branch
-- starts its sequence from 1 on each date

-- =====================================================
-- HELPER FUNCTION: Generate Transaction Number (Branch-Specific)
-- =====================================================
CREATE OR REPLACE FUNCTION medwise.generate_transaction_number(p_branch_id INTEGER)
RETURNS TEXT AS $$
DECLARE
  v_today_prefix TEXT;
  v_last_number TEXT;
  v_next_sequence INTEGER;
BEGIN
  -- Get today's date as prefix (YYYYMMDD)
  v_today_prefix := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

  -- Get last transaction number for today and this branch
  -- Order by numeric sequence part, not lexicographically
  SELECT transaction_number INTO v_last_number
  FROM medwise.transactions
  WHERE transaction_number LIKE v_today_prefix || '-%'
    AND branch_id = p_branch_id
  ORDER BY (SPLIT_PART(transaction_number, '-', 2)::INTEGER) DESC
  LIMIT 1;

  -- Calculate next sequence
  IF v_last_number IS NULL THEN
    v_next_sequence := 1;
  ELSE
    v_next_sequence := SPLIT_PART(v_last_number, '-', 2)::INTEGER + 1;
  END IF;

  RETURN v_today_prefix || '-' || v_next_sequence;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION medwise.generate_transaction_number(INTEGER) TO authenticated;
