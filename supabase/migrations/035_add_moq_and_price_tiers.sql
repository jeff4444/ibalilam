-- Add MOQ (Minimum Order Quantity) fields and price tiers for phone parts and accessories

-- Add MOQ fields to parts table
ALTER TABLE parts ADD COLUMN IF NOT EXISTS moq_units INTEGER DEFAULT 1;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS order_increment INTEGER DEFAULT 1;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS pack_size_units INTEGER;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS stock_on_hand_units INTEGER DEFAULT 0;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS backorder_allowed BOOLEAN DEFAULT false;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS lead_time_days INTEGER;

-- Create price_tiers table for tier-based pricing
CREATE TABLE IF NOT EXISTS price_tiers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  part_id UUID REFERENCES parts(id) ON DELETE CASCADE NOT NULL,
  min_qty INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CHECK (min_qty > 0),
  CHECK (unit_price > 0),
  UNIQUE(part_id, min_qty)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_price_tiers_part_id ON price_tiers(part_id);
CREATE INDEX IF NOT EXISTS idx_price_tiers_min_qty ON price_tiers(part_id, min_qty);

-- Enable Row Level Security for price_tiers
ALTER TABLE price_tiers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for price_tiers
CREATE POLICY "Public can view price tiers" ON price_tiers
  FOR SELECT USING (true);

CREATE POLICY "Users can manage price tiers for their own parts" ON price_tiers
  FOR ALL USING (
    part_id IN (
      SELECT p.id FROM parts p
      JOIN shops s ON p.shop_id = s.id
      WHERE s.user_id = auth.uid()
    )
  );

-- Create function to validate MOQ rules
CREATE OR REPLACE FUNCTION validate_moq_quantity(
  part_id_param UUID,
  quantity INTEGER
)
RETURNS TABLE (
  is_valid BOOLEAN,
  error_message TEXT,
  suggested_quantity INTEGER
) AS $$
DECLARE
  part_record RECORD;
  moq_units INTEGER;
  order_increment INTEGER;
  pack_size_units INTEGER;
  suggested_qty INTEGER;
  error_msg TEXT;
BEGIN
  -- Get part MOQ information
  SELECT moq_units, order_increment, pack_size_units
  INTO part_record
  FROM parts
  WHERE id = part_id_param;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Part not found'::TEXT, quantity;
    RETURN;
  END IF;
  
  moq_units := COALESCE(part_record.moq_units, 1);
  order_increment := COALESCE(part_record.order_increment, 1);
  pack_size_units := part_record.pack_size_units;
  suggested_qty := quantity;
  error_msg := '';
  
  -- Check minimum quantity
  IF quantity < moq_units THEN
    error_msg := error_msg || 'Quantity must be at least ' || moq_units || ' units. ';
    suggested_qty := moq_units;
  END IF;
  
  -- Check pack size (takes precedence over order increment)
  IF pack_size_units IS NOT NULL THEN
    IF quantity % pack_size_units != 0 THEN
      error_msg := error_msg || 'Quantity must be in packs of ' || pack_size_units || '. ';
      suggested_qty := CEIL(quantity::DECIMAL / pack_size_units) * pack_size_units;
    END IF;
  ELSE
    -- Check order increment only if no pack size
    IF quantity % order_increment != 0 THEN
      error_msg := error_msg || 'Quantity must be in increments of ' || order_increment || '. ';
      suggested_qty := CEIL(quantity::DECIMAL / order_increment) * order_increment;
    END IF;
  END IF;
  
  -- Ensure suggested quantity meets MOQ
  IF suggested_qty < moq_units THEN
    suggested_qty := moq_units;
  END IF;
  
  RETURN QUERY SELECT 
    CASE WHEN error_msg = '' THEN true ELSE false END,
    error_msg,
    suggested_qty;
END;
$$ LANGUAGE plpgsql;

-- Create function to get tier pricing for a part and quantity
CREATE OR REPLACE FUNCTION get_tier_price(
  part_id_param UUID,
  quantity INTEGER
)
RETURNS TABLE (
  unit_price DECIMAL(10,2),
  total_price DECIMAL(10,2),
  tier_name TEXT
) AS $$
DECLARE
  best_tier RECORD;
  base_price DECIMAL(10,2);
BEGIN
  -- Get the best tier price for the quantity
  SELECT pt.unit_price, pt.min_qty
  INTO best_tier
  FROM price_tiers pt
  WHERE pt.part_id = part_id_param
    AND pt.min_qty <= quantity
  ORDER BY pt.min_qty DESC
  LIMIT 1;
  
  -- If no tier found, use base price from parts table
  IF best_tier IS NULL THEN
    SELECT price INTO base_price FROM parts WHERE id = part_id_param;
    RETURN QUERY SELECT 
      base_price,
      base_price * quantity,
      'Base Price'::TEXT;
  ELSE
    RETURN QUERY SELECT 
      best_tier.unit_price,
      best_tier.unit_price * quantity,
      'Tier: ' || best_tier.min_qty || '+'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to get available quantity (in-stock + backorder)
CREATE OR REPLACE FUNCTION get_available_quantity(
  part_id_param UUID
)
RETURNS TABLE (
  in_stock INTEGER,
  backorder_available BOOLEAN,
  lead_time_days INTEGER
) AS $$
DECLARE
  part_record RECORD;
BEGIN
  SELECT stock_on_hand_units, backorder_allowed, lead_time_days
  INTO part_record
  FROM parts
  WHERE id = part_id_param;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, false, NULL;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT 
    COALESCE(part_record.stock_on_hand_units, 0),
    COALESCE(part_record.backorder_allowed, false),
    part_record.lead_time_days;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate price tiers
CREATE OR REPLACE FUNCTION validate_price_tiers()
RETURNS TRIGGER AS $$
DECLARE
  moq_units INTEGER;
  tier_count INTEGER;
  prev_tier RECORD;
BEGIN
  -- Get MOQ for this part
  SELECT COALESCE(moq_units, 1) INTO moq_units
  FROM parts WHERE id = NEW.part_id;
  
  -- Check if this is the first tier and min_qty equals MOQ
  SELECT COUNT(*) INTO tier_count
  FROM price_tiers
  WHERE part_id = NEW.part_id;
  
  IF tier_count = 0 AND NEW.min_qty != moq_units THEN
    RAISE EXCEPTION 'First price tier minimum quantity must equal MOQ (%)', moq_units;
  END IF;
  
  -- Check for overlapping tiers
  IF EXISTS (
    SELECT 1 FROM price_tiers
    WHERE part_id = NEW.part_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND (
        (NEW.min_qty BETWEEN min_qty AND min_qty) OR
        (min_qty BETWEEN NEW.min_qty AND NEW.min_qty)
      )
  ) THEN
    RAISE EXCEPTION 'Price tiers cannot overlap';
  END IF;
  
  -- Check that prices are non-increasing with higher quantities
  SELECT * INTO prev_tier
  FROM price_tiers
  WHERE part_id = NEW.part_id
    AND min_qty < NEW.min_qty
  ORDER BY min_qty DESC
  LIMIT 1;
  
  IF prev_tier IS NOT NULL AND NEW.unit_price > prev_tier.unit_price THEN
    RAISE EXCEPTION 'Unit price cannot increase with higher quantities';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for price tier validation
CREATE TRIGGER validate_price_tiers_trigger
  BEFORE INSERT OR UPDATE ON price_tiers
  FOR EACH ROW
  EXECUTE FUNCTION validate_price_tiers();

-- Create trigger to automatically update updated_at for price_tiers
CREATE TRIGGER update_price_tiers_updated_at
  BEFORE UPDATE ON price_tiers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions for new functions
GRANT EXECUTE ON FUNCTION validate_moq_quantity TO authenticated;
GRANT EXECUTE ON FUNCTION get_tier_price TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_quantity TO authenticated;

-- Update existing parts to have default MOQ values
UPDATE parts SET 
  moq_units = 1,
  order_increment = 1,
  stock_on_hand_units = COALESCE(stock_quantity, 0)
WHERE moq_units IS NULL;
