-- =====================================================
-- ADD GL_PERCENT COLUMN TO PRODUCTS TABLE
-- =====================================================
-- This migration adds a gl_percent column to products table
-- for GL (Guaranteed Lowest) pricing calculations

ALTER TABLE medwise.products
ADD COLUMN IF NOT EXISTS gl_percent DECIMAL(5,2) DEFAULT 0;

COMMENT ON COLUMN medwise.products.gl_percent IS 'GL percentage markup (e.g., 20 for 20%)';

