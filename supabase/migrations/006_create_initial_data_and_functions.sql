-- Create function to automatically create a shop for new users
CREATE OR REPLACE FUNCTION create_shop_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create a shop for the new user
  INSERT INTO shops (user_id, name, description, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'shop_name', 'My Shop'),
    COALESCE(NEW.raw_user_meta_data->>'shop_description', 'Welcome to my electronics shop!'),
    true
  );
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically create shop when user signs up
CREATE TRIGGER create_shop_on_user_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_shop_for_new_user();

-- Create function to sync user metadata with shop data
CREATE OR REPLACE FUNCTION sync_user_metadata_with_shop()
RETURNS TRIGGER AS $$
DECLARE
  shop_record RECORD;
BEGIN
  -- Get the user's shop
  SELECT * INTO shop_record
  FROM shops
  WHERE user_id = NEW.id;
  
  -- If shop exists, update it with user metadata
  IF shop_record.id IS NOT NULL THEN
    UPDATE shops
    SET 
      name = COALESCE(NEW.raw_user_meta_data->>'shop_name', shop_record.name),
      description = COALESCE(NEW.raw_user_meta_data->>'shop_description', shop_record.description),
      updated_at = NOW()
    WHERE id = shop_record.id;
  END IF;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to sync user metadata with shop when user metadata is updated
CREATE TRIGGER sync_user_metadata_with_shop_trigger
  AFTER UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_metadata_with_shop();

-- Create function to get shop statistics
CREATE OR REPLACE FUNCTION get_shop_stats(shop_uuid UUID)
RETURNS TABLE (
  total_sales DECIMAL(10,2),
  active_listings INTEGER,
  total_views INTEGER,
  refurbished_sold INTEGER,
  rating DECIMAL(3,2),
  review_count INTEGER,
  conversion_rate DECIMAL(5,2),
  avg_response_time_hours DECIMAL(4,2),
  customer_satisfaction DECIMAL(5,2),
  repeat_customer_rate DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.total_sales,
    s.active_listings,
    s.total_views,
    COALESCE(COUNT(p.id) FILTER (WHERE p.part_type = 'refurbished' AND p.status = 'sold'), 0)::INTEGER as refurbished_sold,
    s.rating,
    s.review_count,
    s.conversion_rate,
    s.avg_response_time_hours,
    s.customer_satisfaction,
    s.repeat_customer_rate
  FROM shops s
  LEFT JOIN parts p ON s.id = p.shop_id
  WHERE s.id = shop_uuid
  GROUP BY s.id, s.total_sales, s.active_listings, s.total_views, s.rating, s.review_count, 
           s.conversion_rate, s.avg_response_time_hours, s.customer_satisfaction, s.repeat_customer_rate;
END;
$$ language 'plpgsql';

-- Create function to get recent orders for a shop
CREATE OR REPLACE FUNCTION get_shop_recent_orders(shop_uuid UUID, limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  order_id UUID,
  order_number TEXT,
  customer_name TEXT,
  customer_email TEXT,
  product_name TEXT,
  amount DECIMAL(10,2),
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id as order_id,
    o.order_number,
    COALESCE(o.customer_name, u.raw_user_meta_data->>'first_name' || ' ' || u.raw_user_meta_data->>'last_name') as customer_name,
    COALESCE(o.customer_email, u.email) as customer_email,
    p.name as product_name,
    oi.total_price as amount,
    o.status,
    o.created_at
  FROM orders o
  LEFT JOIN auth.users u ON o.customer_id = u.id
  LEFT JOIN order_items oi ON o.id = oi.order_id
  LEFT JOIN parts p ON oi.part_id = p.id
  WHERE o.shop_id = shop_uuid
  ORDER BY o.created_at DESC
  LIMIT limit_count;
END;
$$ language 'plpgsql';

-- Create function to search parts
CREATE OR REPLACE FUNCTION search_parts(
  search_query TEXT DEFAULT '',
  category_filter TEXT DEFAULT '',
  min_price DECIMAL DEFAULT 0,
  max_price DECIMAL DEFAULT 999999,
  part_type_filter TEXT DEFAULT '',
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  category TEXT,
  price DECIMAL(10,2),
  stock_quantity INTEGER,
  part_type TEXT,
  image_url TEXT,
  shop_name TEXT,
  shop_rating DECIMAL(3,2),
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.description,
    p.category,
    p.price,
    p.stock_quantity,
    p.part_type,
    p.image_url,
    s.name as shop_name,
    s.rating as shop_rating,
    p.created_at
  FROM parts p
  JOIN shops s ON p.shop_id = s.id
  WHERE p.status = 'active'
    AND p.published_at IS NOT NULL
    AND (search_query = '' OR p.name ILIKE '%' || search_query || '%' OR p.description ILIKE '%' || search_query || '%')
    AND (category_filter = '' OR p.category = category_filter)
    AND p.price >= min_price
    AND p.price <= max_price
    AND (part_type_filter = '' OR p.part_type = part_type_filter)
  ORDER BY p.created_at DESC
  LIMIT limit_count;
END;
$$ language 'plpgsql';

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
