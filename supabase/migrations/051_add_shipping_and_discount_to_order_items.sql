-- Add shipping_amount and discount_amount columns to order_items table
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS shipping_amount DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0.00;

