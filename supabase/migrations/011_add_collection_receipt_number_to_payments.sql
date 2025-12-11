-- =====================================================
-- ADD COLLECTION RECEIPT NUMBER TO TRANSACTION PAYMENTS
-- =====================================================
-- Adds collection_receipt_number field to track collection receipt numbers for payments

-- Add collection_receipt_number column to transaction_payments table
ALTER TABLE medwise.transaction_payments
ADD COLUMN IF NOT EXISTS collection_receipt_number TEXT;

-- Add comment for documentation
COMMENT ON COLUMN medwise.transaction_payments.collection_receipt_number IS 'Collection receipt number for the payment';
