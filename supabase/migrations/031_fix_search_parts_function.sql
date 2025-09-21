-- Fix the search_parts function parameter issue
-- The function was expecting 12 parameters but only receiving 11

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

-- Grant permissions for the fixed function
GRANT EXECUTE ON FUNCTION search_parts TO authenticated;
