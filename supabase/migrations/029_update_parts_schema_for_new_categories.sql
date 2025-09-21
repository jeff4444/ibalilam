-- Update parts table schema for new categories and listing fields
-- This migration adds support for the new category system and product-specific fields

-- Add new columns to parts table
ALTER TABLE parts ADD COLUMN IF NOT EXISTS subcategory TEXT;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS location_city TEXT;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS location_town TEXT;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS condition_status TEXT CHECK (condition_status IN ('new', 'refurbished', 'used'));
ALTER TABLE parts ADD COLUMN IF NOT EXISTS has_box BOOLEAN DEFAULT false;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS has_charger BOOLEAN DEFAULT false;

-- Phone-specific fields
ALTER TABLE parts ADD COLUMN IF NOT EXISTS storage_capacity TEXT;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS imei TEXT;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS network_status TEXT;

-- Phone Parts specific fields
ALTER TABLE parts ADD COLUMN IF NOT EXISTS part_type_detail TEXT; -- Screen/Battery/Charging Port/Camera/etc.
ALTER TABLE parts ADD COLUMN IF NOT EXISTS model_compatibility TEXT; -- e.g., "Samsung A30"
ALTER TABLE parts ADD COLUMN IF NOT EXISTS moq INTEGER DEFAULT 1; -- Minimum Order Quantity

-- Phone Accessories specific fields
ALTER TABLE parts ADD COLUMN IF NOT EXISTS accessory_type TEXT; -- Charger/Case/Earphones/etc.

-- Laptop specific fields
ALTER TABLE parts ADD COLUMN IF NOT EXISTS cpu TEXT;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS ram TEXT;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS storage TEXT;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS screen_size TEXT;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS battery_health INTEGER CHECK (battery_health >= 0 AND battery_health <= 100);

-- STEAM Kits specific fields
ALTER TABLE parts ADD COLUMN IF NOT EXISTS kit_type TEXT; -- Coding/Robotics/AI
ALTER TABLE parts ADD COLUMN IF NOT EXISTS age_group TEXT;

-- Other Electronics specific fields
ALTER TABLE parts ADD COLUMN IF NOT EXISTS electronics_subcategory TEXT; -- TV/Audio/Gaming/Networking/Power
ALTER TABLE parts ADD COLUMN IF NOT EXISTS key_specs TEXT;

-- Create indexes for better search performance
CREATE INDEX IF NOT EXISTS idx_parts_brand ON parts(brand);
CREATE INDEX IF NOT EXISTS idx_parts_model ON parts(model);
CREATE INDEX IF NOT EXISTS idx_parts_subcategory ON parts(subcategory);
CREATE INDEX IF NOT EXISTS idx_parts_condition_status ON parts(condition_status);
CREATE INDEX IF NOT EXISTS idx_parts_location_city ON parts(location_city);
CREATE INDEX IF NOT EXISTS idx_parts_imei ON parts(imei);
CREATE INDEX IF NOT EXISTS idx_parts_part_type_detail ON parts(part_type_detail);
CREATE INDEX IF NOT EXISTS idx_parts_model_compatibility ON parts(model_compatibility);
CREATE INDEX IF NOT EXISTS idx_parts_accessory_type ON parts(accessory_type);
CREATE INDEX IF NOT EXISTS idx_parts_kit_type ON parts(kit_type);

-- Create full-text search index for enhanced search
CREATE INDEX IF NOT EXISTS idx_parts_search_text ON parts USING gin(
  to_tsvector('english', 
    COALESCE(name, '') || ' ' || 
    COALESCE(description, '') || ' ' || 
    COALESCE(brand, '') || ' ' || 
    COALESCE(model, '') || ' ' ||
    COALESCE(subcategory, '') || ' ' ||
    COALESCE(part_type_detail, '') || ' ' ||
    COALESCE(model_compatibility, '') || ' ' ||
    COALESCE(accessory_type, '') || ' ' ||
    COALESCE(kit_type, '')
  )
);

-- Drop existing search_parts function if it exists
DROP FUNCTION IF EXISTS search_parts(TEXT, TEXT, DECIMAL, DECIMAL, TEXT, INTEGER);

-- Update search_parts function to include new fields
CREATE OR REPLACE FUNCTION search_parts(
  search_query TEXT DEFAULT '',
  category_filter TEXT DEFAULT '',
  subcategory_filter TEXT DEFAULT '',
  brand_filter TEXT DEFAULT '',
  model_filter TEXT DEFAULT '',
  condition_filter TEXT DEFAULT '',
  min_price DECIMAL DEFAULT 0,
  max_price DECIMAL DEFAULT 999999,
  location_filter TEXT DEFAULT '',
  fica_verified_only BOOLEAN DEFAULT false,
  sort_by TEXT DEFAULT 'relevance',
  limit_count INTEGER DEFAULT 50,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  category TEXT,
  subcategory TEXT,
  brand TEXT,
  model TEXT,
  condition_status TEXT,
  price DECIMAL(10,2),
  stock_quantity INTEGER,
  part_type TEXT,
  image_url TEXT,
  location_city TEXT,
  location_town TEXT,
  shop_name TEXT,
  shop_rating DECIMAL(3,2),
  shop_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  views INTEGER
) AS $$
DECLARE
  sort_clause TEXT;
  fica_filter TEXT;
BEGIN
  -- Build sort clause
  CASE sort_by
    WHEN 'price-low' THEN sort_clause := 'p.price ASC';
    WHEN 'price-high' THEN sort_clause := 'p.price DESC';
    WHEN 'newest' THEN sort_clause := 'p.created_at DESC';
    WHEN 'most-viewed' THEN sort_clause := 'p.views DESC';
    ELSE sort_clause := 'p.views DESC, p.created_at DESC'; -- relevance
  END CASE;

  -- Build FICA filter
  IF fica_verified_only THEN
    fica_filter := 'AND up.fica_status = ''verified''';
  ELSE
    fica_filter := '';
  END IF;

  RETURN QUERY EXECUTE format('
    SELECT 
      p.id,
      p.name,
      p.description,
      p.category,
      p.subcategory,
      p.brand,
      p.model,
      p.condition_status,
      p.price,
      p.stock_quantity,
      p.part_type,
      p.image_url,
      p.location_city,
      p.location_town,
      s.name as shop_name,
      s.rating as shop_rating,
      s.user_id as shop_user_id,
      p.created_at,
      p.views
    FROM parts p
    JOIN shops s ON p.shop_id = s.id
    JOIN user_profiles up ON s.user_id = up.user_id
    WHERE p.status = ''active''
      AND p.published_at IS NOT NULL
      AND ($1 = '''' OR p.name ILIKE ''%%'' || $1 || ''%%'' OR p.description ILIKE ''%%'' || $1 || ''%%'' OR p.brand ILIKE ''%%'' || $1 || ''%%'' OR p.model ILIKE ''%%'' || $1 || ''%%'' OR to_tsvector(''english'', p.name || '' '' || COALESCE(p.description, '''') || '' '' || COALESCE(p.brand, '''') || '' '' || COALESCE(p.model, '''')) @@ plainto_tsquery(''english'', $1))
      AND ($2 = '''' OR p.category = $2)
      AND ($3 = '''' OR p.subcategory = $3)
      AND ($4 = '''' OR p.brand = $4)
      AND ($5 = '''' OR p.model = $5)
      AND ($6 = '''' OR p.condition_status = $6)
      AND p.price >= $7
      AND p.price <= $8
      AND ($9 = '''' OR p.location_city ILIKE ''%%'' || $9 || ''%%'' OR p.location_town ILIKE ''%%'' || $9 || ''%%'')
      %s
    ORDER BY %s
    LIMIT $11 OFFSET $12',
    fica_filter,
    sort_clause
  ) USING search_query, category_filter, subcategory_filter, brand_filter, model_filter, condition_filter, min_price, max_price, location_filter, limit_count, offset_count;
END;
$$ language 'plpgsql';

-- Create function to get category hierarchy
CREATE OR REPLACE FUNCTION get_category_hierarchy()
RETURNS TABLE (
  category TEXT,
  subcategories TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 'mobile_phones'::TEXT, ARRAY['smartphones', 'feature_phones']::TEXT[]
  UNION ALL
  SELECT 'phone_parts'::TEXT, ARRAY['screen', 'battery', 'charging_port', 'camera', 'speaker', 'microphone', 'housing', 'other']::TEXT[]
  UNION ALL
  SELECT 'phone_accessories'::TEXT, ARRAY['charger', 'case', 'earphones', 'screen_protector', 'cable', 'other']::TEXT[]
  UNION ALL
  SELECT 'laptops'::TEXT, ARRAY['gaming', 'business', 'ultrabook', 'workstation', 'chromebook', 'other']::TEXT[]
  UNION ALL
  SELECT 'steam_kits'::TEXT, ARRAY['coding', 'robotics', 'ai', 'electronics', 'other']::TEXT[]
  UNION ALL
  SELECT 'other_electronics'::TEXT, ARRAY['tv', 'audio', 'gaming', 'networking', 'power', 'other']::TEXT[];
END;
$$ language 'plpgsql';

-- Create function to validate IMEI for phone listings
CREATE OR REPLACE FUNCTION validate_phone_listing()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this is a phone listing and IMEI is required
  IF NEW.category = 'mobile_phones' AND (NEW.imei IS NULL OR NEW.imei = '') THEN
    RAISE EXCEPTION 'IMEI is mandatory for mobile phone listings';
  END IF;
  
  -- Check if this is a phone part and model compatibility is required
  IF NEW.category = 'phone_parts' AND (NEW.model_compatibility IS NULL OR NEW.model_compatibility = '') THEN
    RAISE EXCEPTION 'Model compatibility is required for phone parts listings';
  END IF;
  
  -- Check if this is a phone part and part_type_detail is required
  IF NEW.category = 'phone_parts' AND (NEW.part_type_detail IS NULL OR NEW.part_type_detail = '') THEN
    RAISE EXCEPTION 'Part type detail is required for phone parts listings';
  END IF;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to validate phone listings
CREATE TRIGGER validate_phone_listing_trigger
  BEFORE INSERT OR UPDATE ON parts
  FOR EACH ROW
  EXECUTE FUNCTION validate_phone_listing();

-- Update RLS policies to include new columns
DROP POLICY IF EXISTS "Public can view active parts" ON parts;
CREATE POLICY "Public can view active parts" ON parts
  FOR SELECT USING (status = 'active' AND published_at IS NOT NULL);

-- Grant permissions for new functions
GRANT EXECUTE ON FUNCTION search_parts TO authenticated;
GRANT EXECUTE ON FUNCTION get_category_hierarchy TO authenticated;
GRANT EXECUTE ON FUNCTION validate_phone_listing TO authenticated;