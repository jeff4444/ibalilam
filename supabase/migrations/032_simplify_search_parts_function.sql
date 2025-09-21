-- Simplify the search_parts function to avoid dynamic SQL issues
-- This version uses static SQL with proper parameter handling

DROP FUNCTION IF EXISTS search_parts(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DECIMAL, DECIMAL, TEXT, BOOLEAN, TEXT, INTEGER, INTEGER);

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
  JOIN user_profiles up ON s.user_id = up.user_id
  WHERE p.status = 'active'
    AND p.published_at IS NOT NULL
    AND (search_query = '' OR 
         p.name ILIKE '%' || search_query || '%' OR 
         p.description ILIKE '%' || search_query || '%' OR 
         p.brand ILIKE '%' || search_query || '%' OR 
         p.model ILIKE '%' || search_query || '%')
    AND (category_filter = '' OR p.category = category_filter)
    AND (subcategory_filter = '' OR p.subcategory = subcategory_filter)
    AND (brand_filter = '' OR p.brand = brand_filter)
    AND (model_filter = '' OR p.model = model_filter)
    AND (condition_filter = '' OR p.condition_status = condition_filter)
    AND p.price >= min_price
    AND p.price <= max_price
    AND (location_filter = '' OR 
         p.location_city ILIKE '%' || location_filter || '%' OR 
         p.location_town ILIKE '%' || location_filter || '%')
    AND (NOT fica_verified_only OR up.fica_status = 'verified')
  ORDER BY 
    CASE sort_by
      WHEN 'price-low' THEN p.price
      ELSE NULL
    END ASC,
    CASE sort_by
      WHEN 'price-high' THEN p.price
      ELSE NULL
    END DESC,
    CASE sort_by
      WHEN 'newest' THEN p.created_at
      ELSE NULL
    END DESC,
    CASE sort_by
      WHEN 'most-viewed' THEN p.views
      ELSE NULL
    END DESC,
    CASE sort_by
      WHEN 'relevance' OR sort_by = '' THEN p.views
      ELSE NULL
    END DESC,
    p.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ language 'plpgsql';

-- Grant permissions for the simplified function
GRANT EXECUTE ON FUNCTION search_parts TO authenticated;
