-- Migration 015: Track when a transaction was delivered
--
-- Adds a `delivered_at` timestamp to transactions so we can show how long a
-- delivery took (created_at -> delivered_at) versus how long a still-pending
-- delivery has been waiting (created_at -> now).
--
-- The column is populated by the app when delivery_status changes to
-- "Delivered", and cleared when it is reverted to "Pending".

ALTER TABLE medwise.transactions
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
