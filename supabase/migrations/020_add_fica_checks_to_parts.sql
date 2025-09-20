-- Add FICA verification checks to parts publishing

-- Create function to check FICA status before publishing parts
CREATE OR REPLACE FUNCTION check_fica_before_publish()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check when status is being changed to 'active'
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    -- Check if the shop owner has verified FICA status
    IF NOT EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN shops s ON s.user_id = up.user_id
      WHERE s.id = NEW.shop_id
      AND up.user_role = 'seller'
      AND up.fica_status = 'verified'
    ) THEN
      RAISE EXCEPTION 'Cannot publish listing: Seller must have verified FICA status to publish listings';
    END IF;
    
    -- Set published_at timestamp
    NEW.published_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce FICA verification before publishing
CREATE TRIGGER check_fica_before_publish_trigger
  BEFORE UPDATE ON parts
  FOR EACH ROW
  EXECUTE FUNCTION check_fica_before_publish();

-- Also check on INSERT
CREATE TRIGGER check_fica_before_publish_insert_trigger
  BEFORE INSERT ON parts
  FOR EACH ROW
  EXECUTE FUNCTION check_fica_before_publish();
