-- =====================================================
-- CONSIGNMENT PAYMENTS
-- =====================================================
-- Consignments could record sales but never collections: `total_paid` was
-- always 0 and `balance_due` ("Payable to Medwise") only ever went up. This
-- adds the payment ledger behind the Manage Payments modal, and keeps the two
-- rollup columns derived from it — same shape as transaction_payments.

CREATE TABLE IF NOT EXISTS medwise.consignment_payments (
  id BIGSERIAL PRIMARY KEY,
  consignment_id BIGINT NOT NULL
    REFERENCES medwise.consignments(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  payment_date TIMESTAMP NOT NULL DEFAULT NOW(),
  payment_method TEXT NOT NULL DEFAULT 'Cash',
  reference_number TEXT,
  collection_receipt_number TEXT,

  -- Cheque details
  bank_name TEXT,
  cheque_date DATE,

  -- GL details
  billing_agency TEXT,
  beneficiary_name TEXT,

  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_consignment_payments_consignment
  ON medwise.consignment_payments(consignment_id);
CREATE INDEX IF NOT EXISTS idx_consignment_payments_date
  ON medwise.consignment_payments(payment_date);

COMMENT ON TABLE medwise.consignment_payments IS 'Collections against a monthly consignment. consignments.total_paid / balance_due are derived from these rows.';

-- -----------------------------------------------------
-- Keep total_paid / balance_due derived from the ledger
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION medwise.recompute_consignment_payment_totals(
  p_consignment_id BIGINT
) RETURNS VOID AS $$
DECLARE
  v_sold_value NUMERIC(12,2);
  v_total_paid NUMERIC(12,2);
BEGIN
  IF p_consignment_id IS NULL THEN
    RETURN;
  END IF;

  -- Lock the parent row so concurrent payment writes serialize here.
  SELECT COALESCE(total_sold_value, 0) INTO v_sold_value
  FROM medwise.consignments
  WHERE id = p_consignment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM medwise.consignment_payments
  WHERE consignment_id = p_consignment_id;

  UPDATE medwise.consignments
  SET
    total_paid  = v_total_paid,
    balance_due = v_sold_value - v_total_paid,
    updated_at  = NOW()
  WHERE id = p_consignment_id;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------
-- Reject collections beyond what was actually sold
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION medwise.tg_consignment_payments_guard()
RETURNS TRIGGER AS $$
DECLARE
  v_sold_value NUMERIC(12,2);
  v_other_paid NUMERIC(12,2);
BEGIN
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COALESCE(total_sold_value, 0) INTO v_sold_value
  FROM medwise.consignments
  WHERE id = NEW.consignment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_other_paid
  FROM medwise.consignment_payments
  WHERE consignment_id = NEW.consignment_id
    AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF v_other_paid + NEW.amount > v_sold_value + 0.005 THEN
    RAISE EXCEPTION
      'Payment of % exceeds the remaining balance of % on this consignment.',
      NEW.amount, GREATEST(v_sold_value - v_other_paid, 0)
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS consignment_payments_guard
  ON medwise.consignment_payments;
CREATE TRIGGER consignment_payments_guard
  BEFORE INSERT OR UPDATE ON medwise.consignment_payments
  FOR EACH ROW EXECUTE FUNCTION medwise.tg_consignment_payments_guard();

CREATE OR REPLACE FUNCTION medwise.tg_consignment_payments_sync_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM medwise.recompute_consignment_payment_totals(OLD.consignment_id);
  END IF;

  -- On an amount-only UPDATE the OLD branch above already covers this
  -- consignment; only recompute again when the payment was moved.
  IF TG_OP = 'INSERT'
     OR (TG_OP = 'UPDATE'
         AND NEW.consignment_id IS DISTINCT FROM OLD.consignment_id) THEN
    PERFORM medwise.recompute_consignment_payment_totals(NEW.consignment_id);
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS consignment_payments_sync_totals
  ON medwise.consignment_payments;
CREATE TRIGGER consignment_payments_sync_totals
  AFTER INSERT OR UPDATE OR DELETE ON medwise.consignment_payments
  FOR EACH ROW EXECUTE FUNCTION medwise.tg_consignment_payments_sync_totals();

-- Existing consignments keep the balance_due they already carry: with no
-- payments recorded, total_sold_value - 0 is the value they already hold, and
-- record_consignment_sale keeps adding to it as before.

GRANT SELECT, INSERT, UPDATE, DELETE ON medwise.consignment_payments TO authenticated;
GRANT USAGE ON SEQUENCE medwise.consignment_payments_id_seq TO authenticated;
GRANT EXECUTE ON FUNCTION medwise.recompute_consignment_payment_totals(BIGINT) TO authenticated;
