-- Create shop_analytics table for tracking shop performance metrics
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
  total_sales DECIMAL(10,2) DEFAULT 0.00,
  average_order_value DECIMAL(10,2) DEFAULT 0.00,
  
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shop_analytics_shop_id ON shop_analytics(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_analytics_date ON shop_analytics(date);
CREATE INDEX IF NOT EXISTS idx_shop_analytics_shop_date ON shop_analytics(shop_id, date);

-- Enable Row Level Security
ALTER TABLE shop_analytics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view analytics for their own shop" ON shop_analytics
  FOR SELECT USING (
    shop_id IN (
      SELECT id FROM shops WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert analytics for their own shop" ON shop_analytics
  FOR INSERT WITH CHECK (
    shop_id IN (
      SELECT id FROM shops WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update analytics for their own shop" ON shop_analytics
  FOR UPDATE USING (
    shop_id IN (
      SELECT id FROM shops WHERE user_id = auth.uid()
    )
  );

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_shop_analytics_updated_at
  BEFORE UPDATE ON shop_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to update shop metrics from analytics
CREATE OR REPLACE FUNCTION update_shop_metrics_from_analytics()
RETURNS TRIGGER AS $$
DECLARE
  total_sales DECIMAL(10,2);
  total_views INTEGER;
  active_listings INTEGER;
  conversion_rate DECIMAL(5,2);
  customer_satisfaction DECIMAL(5,2);
  repeat_customer_rate DECIMAL(5,2);
BEGIN
  -- Get latest metrics from analytics
  SELECT 
    COALESCE(SUM(total_sales), 0),
    COALESCE(SUM(page_views), 0),
    COALESCE(AVG(conversion_rate), 0.00)
  INTO total_sales, total_views, conversion_rate
  FROM shop_analytics
  WHERE shop_id = NEW.shop_id
    AND date >= CURRENT_DATE - INTERVAL '30 days';
  
  -- Get active listings count
  SELECT COUNT(*)
  INTO active_listings
  FROM parts
  WHERE shop_id = NEW.shop_id
    AND status = 'active';
  
  -- Get customer satisfaction from reviews
  SELECT COALESCE(AVG(rating), 0.00)
  INTO customer_satisfaction
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
  INTO repeat_customer_rate
  FROM (
    SELECT customer_id, COUNT(*) as order_count
    FROM orders
    WHERE shop_id = NEW.shop_id
      AND created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY customer_id
  ) customer_orders;
  
  -- Update shop with calculated metrics
  UPDATE shops
  SET 
    total_sales = total_sales,
    total_views = total_views,
    active_listings = active_listings,
    conversion_rate = conversion_rate,
    customer_satisfaction = customer_satisfaction,
    repeat_customer_rate = repeat_customer_rate
  WHERE id = NEW.shop_id;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to update shop metrics when analytics change
CREATE TRIGGER update_shop_metrics_trigger
  AFTER INSERT OR UPDATE ON shop_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_shop_metrics_from_analytics();
