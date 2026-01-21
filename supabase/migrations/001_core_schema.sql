-- ============================================================
-- 001_core_schema.sql
-- Core tables: shops, user_profiles, parts, price_tiers
-- ============================================================

-- ============================================================
-- UTILITY FUNCTIONS
-- ============================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update full_name when first_name or last_name changes
CREATE OR REPLACE FUNCTION update_user_full_name()
RETURNS TRIGGER AS $$
BEGIN
  NEW.full_name = TRIM(CONCAT(COALESCE(NEW.first_name, ''), ' ', COALESCE(NEW.last_name, '')));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SHOPS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS shops (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Ratings and reviews
  rating DECIMAL(3,2) DEFAULT 0.00,
  review_count INTEGER DEFAULT 0,
  
  -- Sales and analytics
  total_sales DECIMAL(18,2) DEFAULT 0.00,
  total_views INTEGER DEFAULT 0,
  active_listings INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,2) DEFAULT 0.00,
  avg_response_time_hours DECIMAL(4,2) DEFAULT 0.00,
  customer_satisfaction DECIMAL(5,2) DEFAULT 0.00,
  repeat_customer_rate DECIMAL(5,2) DEFAULT 0.00,
  
  -- Balance management (escrow system)
  locked_balance DECIMAL(18,2) DEFAULT 0.00,
  available_balance DECIMAL(18,2) DEFAULT 0.00,
  
  -- Shop policies
  return_policy TEXT,
  shipping_policy TEXT,
  payment_policy TEXT,
  warranty_policy TEXT,
  privacy_policy TEXT,
  terms_of_service TEXT,
  
  -- FICA/Business verification fields
  registration_number TEXT,
  owner_name TEXT,
  owner_phone TEXT,
  owner_email TEXT,
  
  -- Distribution locations
  distribution_locations TEXT[] DEFAULT '{}',
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id),
  CONSTRAINT chk_locked_balance_non_negative CHECK (locked_balance >= 0),
  CONSTRAINT chk_available_balance_non_negative CHECK (available_balance >= 0),
  CONSTRAINT chk_shop_total_sales_max CHECK (total_sales < 1000000000000.00),
  CONSTRAINT chk_shop_locked_balance_max CHECK (locked_balance < 1000000000000.00),
  CONSTRAINT chk_shop_available_balance_max CHECK (available_balance < 1000000000000.00)
);

-- Indexes for shops
CREATE INDEX IF NOT EXISTS idx_shops_user_id ON shops(user_id);
CREATE INDEX IF NOT EXISTS idx_shops_is_active ON shops(is_active);

-- Enable RLS for shops
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at
CREATE TRIGGER update_shops_updated_at
  BEFORE UPDATE ON shops
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON COLUMN shops.locked_balance IS 'Funds held in escrow until order delivery';
COMMENT ON COLUMN shops.available_balance IS 'Funds available for withdrawal after order delivery';
COMMENT ON COLUMN shops.distribution_locations IS 'Array of distribution center locations (cities or full addresses) where seller can ship from';

-- ============================================================
-- USER_PROFILES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Basic info
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  phone TEXT,
  location TEXT,
  address TEXT,
  bio TEXT,
  specializations TEXT[] DEFAULT '{}',
  avatar_url TEXT,
  
  -- Role and permissions (user_role is visitor/buyer/seller)
  -- NOTE: Admin status is managed in the separate 'admins' table for security
  user_role TEXT CHECK (user_role IN ('visitor', 'buyer', 'seller')) DEFAULT 'visitor',
  
  -- FICA verification
  fica_status TEXT CHECK (fica_status IN ('pending', 'verified', 'rejected')) DEFAULT NULL,
  fica_rejection_reason TEXT DEFAULT NULL,
  fica_verified_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  fica_reviewed_by UUID REFERENCES auth.users(id) DEFAULT NULL,
  fica_reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  
  -- Suspension
  is_suspended BOOLEAN DEFAULT false,
  suspension_reason TEXT,
  suspension_until TIMESTAMP WITH TIME ZONE,
  
  -- Notification preferences
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT true,
  message_notifications BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id)
);

-- Indexes for user_profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_role ON user_profiles(user_role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_fica_status ON user_profiles(fica_status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_suspended ON user_profiles(is_suspended);
CREATE INDEX IF NOT EXISTS idx_user_profiles_full_name ON user_profiles(full_name);
CREATE INDEX IF NOT EXISTS idx_user_profiles_avatar_url ON user_profiles(avatar_url);

-- Enable RLS for user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Triggers for user_profiles
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_user_full_name
  BEFORE INSERT OR UPDATE OF first_name, last_name ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_full_name();

-- Comments
COMMENT ON COLUMN user_profiles.address IS 'User physical address for FICA verification';

-- ============================================================
-- PARTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS parts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  price DECIMAL(18,2) NOT NULL,
  cost DECIMAL(18,2),
  stock_quantity INTEGER DEFAULT 0,
  min_stock_level INTEGER DEFAULT 0,
  status TEXT CHECK (status IN ('active', 'inactive', 'out_of_stock', 'sold', 'draft')) DEFAULT 'draft',
  part_type TEXT CHECK (part_type IN ('original', 'refurbished')) NOT NULL,
  
  -- For refurbished parts
  original_condition TEXT,
  refurbished_condition TEXT,
  time_spent_hours DECIMAL(5,2),
  profit DECIMAL(18,2),
  
  -- Media
  image_url TEXT,
  image_alt TEXT,
  images TEXT[] DEFAULT '{}',
  
  -- SEO and visibility
  views INTEGER DEFAULT 0,
  search_keywords TEXT[],
  
  -- MOQ (Minimum Order Quantity) fields
  moq_units INTEGER DEFAULT 1,
  order_increment INTEGER DEFAULT 1,
  pack_size_units INTEGER,
  stock_on_hand_units INTEGER DEFAULT 0,
  backorder_allowed BOOLEAN DEFAULT false,
  lead_time_days INTEGER,
  
  -- Flagging system
  is_flagged BOOLEAN DEFAULT false,
  flag_reason TEXT,
  flag_count INTEGER DEFAULT 0,
  admin_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT chk_price_positive CHECK (price > 0),
  CONSTRAINT chk_stock_quantity_non_negative CHECK (stock_quantity >= 0),
  CONSTRAINT chk_min_stock_level_non_negative CHECK (min_stock_level >= 0),
  CONSTRAINT chk_part_price_max CHECK (price < 10000000000.00)
);

-- Indexes for parts
CREATE INDEX IF NOT EXISTS idx_parts_shop_id ON parts(shop_id);
CREATE INDEX IF NOT EXISTS idx_parts_status ON parts(status);
CREATE INDEX IF NOT EXISTS idx_parts_part_type ON parts(part_type);
CREATE INDEX IF NOT EXISTS idx_parts_category ON parts(category);
CREATE INDEX IF NOT EXISTS idx_parts_price ON parts(price);
CREATE INDEX IF NOT EXISTS idx_parts_created_at ON parts(created_at);
CREATE INDEX IF NOT EXISTS idx_parts_published_at ON parts(published_at);
CREATE INDEX IF NOT EXISTS idx_parts_is_flagged ON parts(is_flagged);
CREATE INDEX IF NOT EXISTS idx_parts_flag_count ON parts(flag_count);

-- Enable RLS for parts
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at
CREATE TRIGGER update_parts_updated_at
  BEFORE UPDATE ON parts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate profit for refurbished parts
CREATE OR REPLACE FUNCTION calculate_profit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.part_type = 'refurbished' AND NEW.cost IS NOT NULL AND NEW.price IS NOT NULL THEN
    NEW.profit = NEW.price - NEW.cost;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically calculate profit
CREATE TRIGGER calculate_parts_profit
  BEFORE INSERT OR UPDATE ON parts
  FOR EACH ROW
  EXECUTE FUNCTION calculate_profit();

-- ============================================================
-- PRICE_TIERS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS price_tiers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  part_id UUID REFERENCES parts(id) ON DELETE CASCADE NOT NULL,
  min_qty INTEGER NOT NULL,
  unit_price DECIMAL(18,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT chk_min_qty_positive CHECK (min_qty > 0),
  CONSTRAINT chk_unit_price_positive CHECK (unit_price > 0),
  CONSTRAINT chk_tier_price_max CHECK (unit_price < 10000000000.00),
  UNIQUE(part_id, min_qty)
);

-- Indexes for price_tiers
CREATE INDEX IF NOT EXISTS idx_price_tiers_part_id ON price_tiers(part_id);
CREATE INDEX IF NOT EXISTS idx_price_tiers_min_qty ON price_tiers(part_id, min_qty);

-- Enable RLS for price_tiers
ALTER TABLE price_tiers ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at
CREATE TRIGGER update_price_tiers_updated_at
  BEFORE UPDATE ON price_tiers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to validate price tiers
CREATE OR REPLACE FUNCTION validate_price_tiers()
RETURNS TRIGGER AS $$
DECLARE
  moq_units INTEGER;
  tier_count INTEGER;
  prev_tier RECORD;
BEGIN
  -- Get MOQ for this part
  SELECT COALESCE(p.moq_units, 1) INTO moq_units
  FROM parts p WHERE p.id = NEW.part_id;
  
  -- Check if this is the first tier and min_qty equals MOQ
  SELECT COUNT(*) INTO tier_count
  FROM price_tiers
  WHERE part_id = NEW.part_id;
  
  IF tier_count = 0 AND NEW.min_qty != moq_units THEN
    RAISE EXCEPTION 'First price tier minimum quantity must equal MOQ (%)', moq_units;
  END IF;
  
  -- Check that prices are non-increasing with higher quantities
  SELECT * INTO prev_tier
  FROM price_tiers
  WHERE part_id = NEW.part_id
    AND min_qty < NEW.min_qty
  ORDER BY min_qty DESC
  LIMIT 1;
  
  IF prev_tier IS NOT NULL AND NEW.unit_price > prev_tier.unit_price THEN
    RAISE EXCEPTION 'Unit price cannot increase with higher quantities';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for price tier validation
CREATE TRIGGER validate_price_tiers_trigger
  BEFORE INSERT OR UPDATE ON price_tiers
  FOR EACH ROW
  EXECUTE FUNCTION validate_price_tiers();
