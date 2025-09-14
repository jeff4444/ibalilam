-- Create reviews table for shop ratings and reviews
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
  is_verified BOOLEAN DEFAULT false, -- True if review is from a verified purchase
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one review per customer per shop
  UNIQUE(shop_id, customer_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_reviews_shop_id ON reviews(shop_id);
CREATE INDEX IF NOT EXISTS idx_reviews_customer_id ON reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at);

-- Enable Row Level Security
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view reviews for their own shop" ON reviews
  FOR SELECT USING (
    shop_id IN (
      SELECT id FROM shops WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own reviews" ON reviews
  FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Users can insert their own reviews" ON reviews
  FOR INSERT WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Users can update their own reviews" ON reviews
  FOR UPDATE USING (customer_id = auth.uid());

CREATE POLICY "Users can delete their own reviews" ON reviews
  FOR DELETE USING (customer_id = auth.uid());

-- Allow public to view approved reviews
CREATE POLICY "Public can view approved reviews" ON reviews
  FOR SELECT USING (status = 'approved');

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to update shop ratings when reviews change
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
$$ language 'plpgsql';

-- Create trigger to update shop ratings when reviews change
CREATE TRIGGER update_shop_ratings_trigger
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_shop_ratings();
