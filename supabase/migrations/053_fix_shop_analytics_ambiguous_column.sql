-- Fix ambiguous column reference in update_shop_metrics_from_analytics function
-- The issue occurs because variable names conflict with column names in the UPDATE statement

CREATE OR REPLACE FUNCTION update_shop_metrics_from_analytics()
RETURNS TRIGGER AS $$
<<func_block>>
DECLARE
  v_total_sales DECIMAL(10,2);
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
  INTO func_block.v_total_sales, func_block.v_total_views, func_block.v_conversion_rate
  FROM shop_analytics sa
  WHERE sa.shop_id = NEW.shop_id
    AND sa.date >= CURRENT_DATE - INTERVAL '30 days';
  
  -- Get active listings count
  SELECT COUNT(*)
  INTO func_block.v_active_listings
  FROM parts
  WHERE shop_id = NEW.shop_id
    AND status = 'active';
  
  -- Get customer satisfaction from reviews
  SELECT COALESCE(AVG(rating), 0.00)
  INTO func_block.v_customer_satisfaction
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
  INTO func_block.v_repeat_customer_rate
  FROM (
    SELECT customer_id, COUNT(*) as order_count
    FROM orders
    WHERE shop_id = NEW.shop_id
      AND created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY customer_id
  ) customer_orders;
  
  -- Update shop with calculated metrics
  -- Use qualified variable names with block label to avoid ambiguity with column names
  UPDATE shops
  SET 
    total_sales = func_block.v_total_sales,
    total_views = func_block.v_total_views,
    active_listings = func_block.v_active_listings,
    conversion_rate = func_block.v_conversion_rate,
    customer_satisfaction = func_block.v_customer_satisfaction,
    repeat_customer_rate = func_block.v_repeat_customer_rate
  WHERE id = NEW.shop_id;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

