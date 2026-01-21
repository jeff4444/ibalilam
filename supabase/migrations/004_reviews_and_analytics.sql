-- ============================================================
-- 004_reviews_and_analytics.sql
-- Reviews and shop analytics
-- ============================================================

-- ============================================================
-- REVIEWS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Review details
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  title TEXT,
  comment TEXT,
  
  -- Review status
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  is_verified BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one review per customer per shop
  UNIQUE(shop_id, customer_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reviews_shop_id ON reviews(shop_id);
CREATE INDEX IF NOT EXISTS idx_reviews_customer_id ON reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at);

-- Enable RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to update shop ratings when reviews change
CREATE OR REPLACE FUNCTION update_shop_ratings()
RETURNS TRIGGER AS $$
DECLARE
  shop_rating DECIMAL(3,2);
  shop_review_count INTEGER;
BEGIN
  -- Calculate new average rating and review count
  SELECT 
    ROUND(AVG(rating)::DECIMAL, 2),
    COUNT(*)
  INTO shop_rating, shop_review_count
  FROM reviews
  WHERE shop_id = COALESCE(NEW.shop_id, OLD.shop_id)
    AND status = 'approved';
  
  -- Update shop with new rating and review count
  UPDATE shops
  SET 
    rating = COALESCE(shop_rating, 0.00),
    review_count = COALESCE(shop_review_count, 0)
  WHERE id = COALESCE(NEW.shop_id, OLD.shop_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update shop ratings when reviews change
CREATE TRIGGER update_shop_ratings_trigger
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_shop_ratings();

-- ============================================================
-- SHOP_ANALYTICS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS shop_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  
  -- Date for the analytics record
  date DATE NOT NULL,
  
  -- Traffic metrics
  page_views INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  
  -- Sales metrics
  orders_count INTEGER DEFAULT 0,
  total_sales DECIMAL(18,2) DEFAULT 0.00,
  average_order_value DECIMAL(18,2) DEFAULT 0.00,
  
  -- Conversion metrics
  conversion_rate DECIMAL(5,2) DEFAULT 0.00,
  
  -- Inventory metrics
  new_listings INTEGER DEFAULT 0,
  sold_listings INTEGER DEFAULT 0,
  out_of_stock_listings INTEGER DEFAULT 0,
  
  -- Customer metrics
  new_customers INTEGER DEFAULT 0,
  returning_customers INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one record per shop per date
  UNIQUE(shop_id, date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shop_analytics_shop_id ON shop_analytics(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_analytics_date ON shop_analytics(date);
CREATE INDEX IF NOT EXISTS idx_shop_analytics_shop_date ON shop_analytics(shop_id, date);

-- Enable RLS
ALTER TABLE shop_analytics ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at
CREATE TRIGGER update_shop_analytics_updated_at
  BEFORE UPDATE ON shop_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to update shop metrics from analytics
CREATE OR REPLACE FUNCTION update_shop_metrics_from_analytics()
RETURNS TRIGGER AS $$
DECLARE
  v_total_sales DECIMAL(18,2);
  v_total_views INTEGER;
  v_active_listings INTEGER;
  v_conversion_rate DECIMAL(5,2);
  v_customer_satisfaction DECIMAL(5,2);
  v_repeat_customer_rate DECIMAL(5,2);
BEGIN
  -- Get latest metrics from analytics
  SELECT 
    COALESCE(SUM(sa.total_sales), 0),
    COALESCE(SUM(sa.page_views), 0),
    COALESCE(AVG(sa.conversion_rate), 0.00)
  INTO v_total_sales, v_total_views, v_conversion_rate
  FROM shop_analytics sa
  WHERE sa.shop_id = NEW.shop_id
    AND sa.date >= CURRENT_DATE - INTERVAL '30 days';
  
  -- Get active listings count
  SELECT COUNT(*)
  INTO v_active_listings
  FROM parts
  WHERE shop_id = NEW.shop_id
    AND status = 'active';
  
  -- Get customer satisfaction from reviews
  SELECT COALESCE(AVG(rating), 0.00)
  INTO v_customer_satisfaction
  FROM reviews
  WHERE shop_id = NEW.shop_id
    AND status = 'approved'
    AND created_at >= CURRENT_DATE - INTERVAL '30 days';
  
  -- Get repeat customer rate
  SELECT 
    CASE 
      WHEN COUNT(DISTINCT customer_id) > 0 THEN
        ROUND(
          (COUNT(DISTINCT customer_id) FILTER (WHERE order_count > 1)::DECIMAL / 
           COUNT(DISTINCT customer_id)::DECIMAL) * 100, 2
        )
      ELSE 0.00
    END
  INTO v_repeat_customer_rate
  FROM (
    SELECT customer_id, COUNT(*) as order_count
    FROM orders
    WHERE shop_id = NEW.shop_id
      AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      AND deleted_at IS NULL
    GROUP BY customer_id
  ) customer_orders;
  
  -- Update shop with calculated metrics
  UPDATE shops
  SET 
    total_sales = v_total_sales,
    total_views = v_total_views,
    active_listings = v_active_listings,
    conversion_rate = v_conversion_rate,
    customer_satisfaction = v_customer_satisfaction,
    repeat_customer_rate = v_repeat_customer_rate
  WHERE id = NEW.shop_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update shop metrics when analytics change
CREATE TRIGGER update_shop_metrics_trigger
  AFTER INSERT OR UPDATE ON shop_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_shop_metrics_from_analytics();

-- ============================================================
-- SHOP STATISTICS FUNCTIONS
-- ============================================================

-- Function to get shop statistics
CREATE OR REPLACE FUNCTION get_shop_stats(shop_uuid UUID)
RETURNS TABLE (
  total_sales DECIMAL(18,2),
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
$$ LANGUAGE plpgsql;

-- Function to get recent orders for a shop
CREATE OR REPLACE FUNCTION get_shop_recent_orders(shop_uuid UUID, limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  order_id UUID,
  order_number TEXT,
  customer_name TEXT,
  customer_email TEXT,
  product_name TEXT,
  amount DECIMAL(18,2),
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
    AND o.deleted_at IS NULL
  ORDER BY o.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;
