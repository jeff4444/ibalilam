-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Customer information (for guest orders)
  customer_email TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  
  -- Order details
  status TEXT CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')) DEFAULT 'pending',
  total_amount DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) DEFAULT 0.00,
  shipping_amount DECIMAL(10,2) DEFAULT 0.00,
  discount_amount DECIMAL(10,2) DEFAULT 0.00,
  
  -- Shipping information
  shipping_address JSONB,
  billing_address JSONB,
  
  -- Payment information
  payment_method TEXT,
  payment_status TEXT CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')) DEFAULT 'pending',
  payment_intent_id TEXT,
  
  -- Order notes
  customer_notes TEXT,
  internal_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CHECK (total_amount > 0),
  CHECK (subtotal > 0)
);

-- Create order_items table for individual items in an order
CREATE TABLE IF NOT EXISTS order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  part_id UUID REFERENCES parts(id) ON DELETE CASCADE NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CHECK (quantity > 0),
  CHECK (unit_price > 0),
  CHECK (total_price > 0)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_part_id ON order_items(part_id);

-- Enable Row Level Security
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for orders
CREATE POLICY "Users can view orders from their own shop" ON orders
  FOR SELECT USING (
    shop_id IN (
      SELECT id FROM shops WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own orders as customer" ON orders
  FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Users can update orders from their own shop" ON orders
  FOR UPDATE USING (
    shop_id IN (
      SELECT id FROM shops WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert orders" ON orders
  FOR INSERT WITH CHECK (true); -- Allow anyone to create orders (for checkout)

-- Create RLS policies for order_items
CREATE POLICY "Users can view order items from their shop orders" ON order_items
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders WHERE shop_id IN (
        SELECT id FROM shops WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can view order items from their own orders" ON order_items
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders WHERE customer_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert order items" ON order_items
  FOR INSERT WITH CHECK (true); -- Allow anyone to create order items (for checkout)

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to generate order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  counter INTEGER;
BEGIN
  -- Get the next counter value
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 'ORD-(\d+)') AS INTEGER)), 0) + 1
  INTO counter
  FROM orders
  WHERE order_number ~ '^ORD-\d+$';
  
  -- Format as ORD-XXX
  new_number := 'ORD-' || LPAD(counter::TEXT, 3, '0');
  
  RETURN new_number;
END;
$$ language 'plpgsql';

-- Create trigger to automatically generate order numbers
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER set_orders_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();

-- Create function to calculate order totals
CREATE OR REPLACE FUNCTION calculate_order_totals()
RETURNS TRIGGER AS $$
DECLARE
  order_subtotal DECIMAL(10,2);
  order_total DECIMAL(10,2);
BEGIN
  -- Calculate subtotal from order items
  SELECT COALESCE(SUM(total_price), 0)
  INTO order_subtotal
  FROM order_items
  WHERE order_id = NEW.order_id;
  
  -- Calculate total (subtotal + tax + shipping - discount)
  order_total := order_subtotal + COALESCE(NEW.tax_amount, 0) + COALESCE(NEW.shipping_amount, 0) - COALESCE(NEW.discount_amount, 0);
  
  -- Update the order
  UPDATE orders
  SET subtotal = order_subtotal, total_amount = order_total
  WHERE id = NEW.order_id;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to recalculate order totals when order items change
CREATE TRIGGER calculate_order_totals_trigger
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_order_totals();
