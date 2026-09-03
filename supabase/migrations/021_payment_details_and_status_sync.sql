-- =====================================================
-- PAYMENT DETAIL COLUMNS + AUTHORITATIVE PAYMENT STATUS
-- =====================================================
-- Fixes three problems with the "Manage Payments" flow:
--
-- 1. `transactions.payment_status` was only ever updated in Redux, so the
--    badge reverted to UNPAID on refresh and every report that buckets money
--    by payment_status (customer sales, daily sales, SOA, …) was wrong.
--    It is now derived from the payments that actually exist, in the database,
--    so it cannot drift from the ledger no matter who writes the payment.
--
-- 2. Cheque/GL details were JSON-encoded into `remarks`, which destroyed the
--    user's free-text remarks and made the values unqueryable. They now have
--    real columns; the legacy JSON blobs are backfilled below.
--
-- 3. The "payment cannot exceed the balance" rule was client-side only, so two
--    users (or two tabs) could each post the full balance. It is enforced here
--    under a row lock on the parent transaction.

-- -----------------------------------------------------
-- 1️⃣ Real columns for cheque / GL details
-- -----------------------------------------------------
ALTER TABLE medwise.transaction_payments
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS cheque_date DATE,
  ADD COLUMN IF NOT EXISTS billing_agency TEXT,
  ADD COLUMN IF NOT EXISTS beneficiary_name TEXT;

COMMENT ON COLUMN medwise.transaction_payments.bank_name IS 'Issuing bank, for Cheque payments';
COMMENT ON COLUMN medwise.transaction_payments.cheque_date IS 'Date written on the cheque, for Cheque payments';
COMMENT ON COLUMN medwise.transaction_payments.billing_agency IS 'Billing agency, for GL payments';
COMMENT ON COLUMN medwise.transaction_payments.beneficiary_name IS 'Name of beneficiary, for GL payments';

-- The app now sends payment_date explicitly (so a payment can be backdated),
-- but keep a default for any other writer.
ALTER TABLE medwise.transaction_payments
  ALTER COLUMN payment_date SET DEFAULT NOW();

-- Parses text as JSONB, returning NULL instead of raising on malformed input.
CREATE OR REPLACE FUNCTION medwise.try_parse_jsonb(p_text TEXT)
RETURNS JSONB AS $$
BEGIN
  RETURN p_text::JSONB;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Backfill the new columns from the legacy JSON blobs, then clear the blob so
-- `remarks` is plain text again. Rows where a human typed real remarks parse to
-- NULL (or to a non-object) and are left untouched.
UPDATE medwise.transaction_payments p
SET
  reference_number = COALESCE(
    p.reference_number,
    j.value->>'cheque_number',
    j.value->>'gl_number'
  ),
  bank_name        = COALESCE(p.bank_name, j.value->>'bank_name'),
  cheque_date      = COALESCE(
    p.cheque_date,
    NULLIF(j.value->>'cheque_date', '')::DATE
  ),
  billing_agency   = COALESCE(p.billing_agency, j.value->>'billing_agency'),
  beneficiary_name = COALESCE(p.beneficiary_name, j.value->>'beneficiary_name'),
  remarks          = NULL
FROM (
  SELECT id, medwise.try_parse_jsonb(remarks) AS value
  FROM medwise.transaction_payments
  WHERE payment_method IN ('Cheque', 'GL')
    AND remarks IS NOT NULL
) j
WHERE p.id = j.id
  AND jsonb_typeof(j.value) = 'object';

-- -----------------------------------------------------
-- 2️⃣ Derive payment_status from the recorded payments
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION medwise.recompute_transaction_payment_status(
  p_transaction_id BIGINT
) RETURNS VOID AS $$
DECLARE
  v_total_amount NUMERIC(12,2);
  v_total_paid   NUMERIC(12,2);
  v_status       TEXT;
BEGIN
  IF p_transaction_id IS NULL THEN
    RETURN;
  END IF;

  -- Lock the parent row so concurrent payment writes serialize here.
  SELECT COALESCE(total_amount, 0) INTO v_total_amount
  FROM medwise.transactions
  WHERE id = p_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM medwise.transaction_payments
  WHERE transaction_id = p_transaction_id;

  IF v_total_paid <= 0 THEN
    v_status := 'Unpaid';
  ELSIF v_total_paid >= v_total_amount - 0.005 THEN
    v_status := 'Paid';
  ELSE
    v_status := 'Partial';
  END IF;

  UPDATE medwise.transactions
  SET payment_status = v_status
  WHERE id = p_transaction_id
    AND payment_status IS DISTINCT FROM v_status;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------
-- 3️⃣ Reject payments beyond the transaction total
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION medwise.tg_transaction_payments_guard()
RETURNS TRIGGER AS $$
DECLARE
  v_total_amount NUMERIC(12,2);
  v_other_paid   NUMERIC(12,2);
BEGIN
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Same lock the recompute takes, so two concurrent payments cannot both
  -- measure the balance before either is visible.
  SELECT COALESCE(total_amount, 0) INTO v_total_amount
  FROM medwise.transactions
  WHERE id = NEW.transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_other_paid
  FROM medwise.transaction_payments
  WHERE transaction_id = NEW.transaction_id
    AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF v_other_paid + NEW.amount > v_total_amount + 0.005 THEN
    RAISE EXCEPTION
      'Payment of % exceeds the remaining balance of % on this transaction.',
      NEW.amount, GREATEST(v_total_amount - v_other_paid, 0)
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS transaction_payments_guard
  ON medwise.transaction_payments;
CREATE TRIGGER transaction_payments_guard
  BEFORE INSERT OR UPDATE ON medwise.transaction_payments
  FOR EACH ROW EXECUTE FUNCTION medwise.tg_transaction_payments_guard();

-- -----------------------------------------------------
-- 4️⃣ Keep payment_status in sync on every ledger change
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION medwise.tg_transaction_payments_sync_status()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM medwise.recompute_transaction_payment_status(OLD.transaction_id);
  END IF;

  -- On an amount-only UPDATE the OLD branch above already covers this
  -- transaction; only recompute again when the payment was moved.
  IF TG_OP = 'INSERT'
     OR (TG_OP = 'UPDATE'
         AND NEW.transaction_id IS DISTINCT FROM OLD.transaction_id) THEN
    PERFORM medwise.recompute_transaction_payment_status(NEW.transaction_id);
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS transaction_payments_sync_status
  ON medwise.transaction_payments;
CREATE TRIGGER transaction_payments_sync_status
  AFTER INSERT OR UPDATE OR DELETE ON medwise.transaction_payments
  FOR EACH ROW EXECUTE FUNCTION medwise.tg_transaction_payments_sync_status();

-- -----------------------------------------------------
-- 5️⃣ Backfill statuses that were only ever set in Redux
-- -----------------------------------------------------
-- Only transactions that actually have payments are touched — transactions
-- created as 'Paid' with no payment rows (retail / agent sales) keep theirs.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT transaction_id
    FROM medwise.transaction_payments
    WHERE transaction_id IS NOT NULL
  LOOP
    PERFORM medwise.recompute_transaction_payment_status(r.transaction_id);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION medwise.try_parse_jsonb(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION medwise.recompute_transaction_payment_status(BIGINT) TO authenticated;
