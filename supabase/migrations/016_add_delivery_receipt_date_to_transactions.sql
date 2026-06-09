-- Migration 016: Editable delivery receipt date
--
-- Adds `delivery_receipt_date` to transactions. This is the actual date on the
-- delivery receipt (when the goods were received), set/edited by staff. It is
-- used to compute how many days a delivery took (created_at -> receipt date),
-- and is preferred over the auto-stamped `delivered_at`.

ALTER TABLE medwise.transactions
  ADD COLUMN IF NOT EXISTS delivery_receipt_date DATE;
