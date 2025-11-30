-- Add tracking fields to orders table for shipping information
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS carrier TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_url TEXT;

-- Create index for tracking number lookups
CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON orders(tracking_number);

-- Add comment for documentation
COMMENT ON COLUMN orders.tracking_number IS 'Shipping tracking number provided by carrier';
COMMENT ON COLUMN orders.carrier IS 'Shipping carrier name (e.g., FedEx, UPS, DHL, Postal Service)';
COMMENT ON COLUMN orders.tracking_url IS 'URL to track the package on carrier website';

