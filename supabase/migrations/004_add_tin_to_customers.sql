-- Add TIN column to customers table
ALTER TABLE medwise.customers 
ADD COLUMN IF NOT EXISTS tin TEXT;
