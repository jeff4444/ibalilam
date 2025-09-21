-- Create a completely new, simple search function to avoid all parameter issues
-- This version uses a minimal parameter set and clear naming

DROP FUNCTION IF EXISTS search_parts(TEXT, TEXT, TEXT, TEXT, TEXT, DECIMAL, DECIMAL, TEXT, TEXT, INTEGER);

-- Create a very simple search function
CREATE OR REPLACE FUNCTION search_parts(
  search_text TEXT DEFAULT '',
  category_name TEXT DEFAULT '',
  min_price_val DECIMAL DEFAULT 0,
  max_price_val DECIMAL DEFAULT 999999,
  sort_order TEXT DEFAULT 'relevance'
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
BEGIN
  RETURN QUERY
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
  WHERE p.status = 'active'
    AND p.published_at IS NOT NULL
    AND (search_text = '' OR 
         p.name ILIKE '%' || search_text || '%' OR 
         p.description ILIKE '%' || search_text || '%' OR 
         p.brand ILIKE '%' || search_text || '%' OR 
         p.model ILIKE '%' || search_text || '%')
    AND (category_name = '' OR p.category = category_name)
    AND p.price >= min_price_val
    AND p.price <= max_price_val
  ORDER BY 
    CASE sort_order
      WHEN 'price-low' THEN p.price
      ELSE NULL
    END ASC,
    CASE sort_order
      WHEN 'price-high' THEN p.price
      ELSE NULL
    END DESC,
    CASE sort_order
      WHEN 'newest' THEN p.created_at
      ELSE NULL
    END DESC,
    CASE sort_order
      WHEN 'most-viewed' THEN p.views
      ELSE NULL
    END DESC,
    p.views DESC,
    p.created_at DESC
  LIMIT 50;
END;
$$ language 'plpgsql';

-- Grant permissions
GRANT EXECUTE ON FUNCTION search_parts TO authenticated;
