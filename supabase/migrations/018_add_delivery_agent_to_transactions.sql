-- Migration 018: Delivery agent on transactions
--
-- Adds `delivery_agent_id` to transactions. This is the agent who delivered the
-- order, selected (optionally) by staff when marking a bulk transaction as
-- Delivered. Used for filtering bulk transactions by agent.

ALTER TABLE medwise.transactions
  ADD COLUMN IF NOT EXISTS delivery_agent_id BIGINT REFERENCES medwise.agents(id);

CREATE INDEX IF NOT EXISTS idx_transactions_delivery_agent
  ON medwise.transactions(delivery_agent_id);
