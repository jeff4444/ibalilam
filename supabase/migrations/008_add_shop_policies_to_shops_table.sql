-- Add shop policies columns to shops table
ALTER TABLE shops ADD COLUMN IF NOT EXISTS return_policy TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS shipping_policy TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS payment_policy TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS warranty_policy TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS privacy_policy TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS terms_of_service TEXT;

-- Add comments for documentation
COMMENT ON COLUMN shops.return_policy IS 'Shop return and refund policy';
COMMENT ON COLUMN shops.shipping_policy IS 'Shop shipping and delivery policy';
COMMENT ON COLUMN shops.payment_policy IS 'Shop payment methods and processing policy';
COMMENT ON COLUMN shops.warranty_policy IS 'Shop warranty and guarantee policy';
COMMENT ON COLUMN shops.privacy_policy IS 'Shop privacy and data handling policy';
COMMENT ON COLUMN shops.terms_of_service IS 'Shop terms of service and usage policy';
