-- Add tax_amount column to order_items table
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) DEFAULT 0.00;

