-- Create parts table
CREATE TABLE IF NOT EXISTS parts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  cost DECIMAL(10,2), -- For refurbished parts
  stock_quantity INTEGER DEFAULT 0,
  min_stock_level INTEGER DEFAULT 0,
  status TEXT CHECK (status IN ('active', 'inactive', 'out_of_stock', 'sold', 'draft')) DEFAULT 'draft',
  part_type TEXT CHECK (part_type IN ('original', 'refurbished')) NOT NULL,
  
  -- For refurbished parts
  original_condition TEXT,
  refurbished_condition TEXT,
  time_spent_hours DECIMAL(5,2),
  profit DECIMAL(10,2),
  
  -- Media
  image_url TEXT,
  image_alt TEXT,
  
  -- SEO and visibility
  views INTEGER DEFAULT 0,
  search_keywords TEXT[],
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CHECK (price > 0),
  CHECK (stock_quantity >= 0),
  CHECK (min_stock_level >= 0)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_parts_shop_id ON parts(shop_id);
CREATE INDEX IF NOT EXISTS idx_parts_status ON parts(status);
CREATE INDEX IF NOT EXISTS idx_parts_part_type ON parts(part_type);
CREATE INDEX IF NOT EXISTS idx_parts_category ON parts(category);
CREATE INDEX IF NOT EXISTS idx_parts_price ON parts(price);
CREATE INDEX IF NOT EXISTS idx_parts_created_at ON parts(created_at);
CREATE INDEX IF NOT EXISTS idx_parts_published_at ON parts(published_at);

-- Enable Row Level Security
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view parts from their own shop" ON parts
  FOR SELECT USING (
    shop_id IN (
      SELECT id FROM shops WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert parts to their own shop" ON parts
  FOR INSERT WITH CHECK (
    shop_id IN (
      SELECT id FROM shops WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update parts in their own shop" ON parts
  FOR UPDATE USING (
    shop_id IN (
      SELECT id FROM shops WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete parts from their own shop" ON parts
  FOR DELETE USING (
    shop_id IN (
      SELECT id FROM shops WHERE user_id = auth.uid()
    )
  );

-- Allow public to view active parts (for marketplace)
CREATE POLICY "Public can view active parts" ON parts
  FOR SELECT USING (status = 'active' AND published_at IS NOT NULL);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_parts_updated_at
  BEFORE UPDATE ON parts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to calculate profit for refurbished parts
CREATE OR REPLACE FUNCTION calculate_profit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.part_type = 'refurbished' AND NEW.cost IS NOT NULL AND NEW.price IS NOT NULL THEN
    NEW.profit = NEW.price - NEW.cost;
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically calculate profit
CREATE TRIGGER calculate_parts_profit
  BEFORE INSERT OR UPDATE ON parts
  FOR EACH ROW
  EXECUTE FUNCTION calculate_profit();
