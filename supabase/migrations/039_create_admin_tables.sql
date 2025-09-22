-- Create tables for admin functionality

-- Create transactions table for payment tracking
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  commission_amount DECIMAL(10,2) DEFAULT 0.00,
  seller_amount DECIMAL(10,2) DEFAULT 0.00,
  status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'disputed')) DEFAULT 'pending',
  payment_method TEXT,
  payment_intent_id TEXT,
  escrow_status TEXT CHECK (escrow_status IN ('held', 'released', 'refunded', 'disputed')) DEFAULT 'held',
  escrow_hold_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  refunded_at TIMESTAMP WITH TIME ZONE,
  refund_reason TEXT,
  dispute_reason TEXT,
  admin_notes TEXT,
  
  -- Constraints
  CHECK (amount > 0),
  CHECK (commission_amount >= 0),
  CHECK (seller_amount >= 0)
);

-- Create escrow_holds table for detailed escrow tracking
CREATE TABLE IF NOT EXISTS escrow_holds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  hold_until TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT CHECK (status IN ('active', 'released', 'refunded')) DEFAULT 'active',
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  released_at TIMESTAMP WITH TIME ZONE,
  refunded_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CHECK (amount > 0)
);

-- Create part_flags table for reporting inappropriate content
CREATE TABLE IF NOT EXISTS part_flags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  part_id UUID REFERENCES parts(id) ON DELETE CASCADE NOT NULL,
  reporter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT CHECK (status IN ('pending', 'resolved', 'dismissed')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id),
  
  -- Ensure one flag per user per part
  UNIQUE(part_id, reporter_id)
);

-- Add flag tracking to parts table
ALTER TABLE parts ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS flag_reason TEXT;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS flag_count INTEGER DEFAULT 0;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Create category_commissions table
CREATE TABLE IF NOT EXISTS category_commissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  commission_percentage DECIMAL(5,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
  UNIQUE(category)
);

-- Create escrow_settings table
CREATE TABLE IF NOT EXISTS escrow_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  escrow_required BOOLEAN DEFAULT true,
  escrow_duration_days INTEGER DEFAULT 7,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CHECK (escrow_duration_days >= 0),
  UNIQUE(category)
);

-- Create global_settings table
CREATE TABLE IF NOT EXISTS global_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  setting_type TEXT CHECK (setting_type IN ('string', 'number', 'boolean', 'json')) DEFAULT 'string',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create feature_flags table
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  flag_name TEXT NOT NULL UNIQUE,
  flag_value BOOLEAN DEFAULT false,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_escrow_status ON transactions(escrow_status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_escrow_holds_transaction_id ON escrow_holds(transaction_id);
CREATE INDEX IF NOT EXISTS idx_escrow_holds_status ON escrow_holds(status);
CREATE INDEX IF NOT EXISTS idx_escrow_holds_hold_until ON escrow_holds(hold_until);

CREATE INDEX IF NOT EXISTS idx_part_flags_part_id ON part_flags(part_id);
CREATE INDEX IF NOT EXISTS idx_part_flags_reporter_id ON part_flags(reporter_id);
CREATE INDEX IF NOT EXISTS idx_part_flags_status ON part_flags(status);

CREATE INDEX IF NOT EXISTS idx_parts_is_flagged ON parts(is_flagged);
CREATE INDEX IF NOT EXISTS idx_parts_flag_count ON parts(flag_count);

-- Enable Row Level Security
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE part_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for transactions (admin only)
CREATE POLICY "Admins can view all transactions" ON transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() AND user_role = 'admin'
    )
  );

CREATE POLICY "Admins can update transactions" ON transactions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() AND user_role = 'admin'
    )
  );

-- Create RLS policies for escrow_holds (admin only)
CREATE POLICY "Admins can view all escrow holds" ON escrow_holds
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() AND user_role = 'admin'
    )
  );

CREATE POLICY "Admins can update escrow holds" ON escrow_holds
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() AND user_role = 'admin'
    )
  );

-- Create RLS policies for part_flags
CREATE POLICY "Users can view their own flags" ON part_flags
  FOR SELECT USING (auth.uid() = reporter_id);

CREATE POLICY "Users can create flags" ON part_flags
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Admins can view all flags" ON part_flags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() AND user_role = 'admin'
    )
  );

CREATE POLICY "Admins can update flags" ON part_flags
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() AND user_role = 'admin'
    )
  );

-- Create RLS policies for configuration tables (admin only)
CREATE POLICY "Admins can manage category commissions" ON category_commissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() AND user_role = 'admin'
    )
  );

CREATE POLICY "Admins can manage escrow settings" ON escrow_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() AND user_role = 'admin'
    )
  );

CREATE POLICY "Admins can manage global settings" ON global_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() AND user_role = 'admin'
    )
  );

CREATE POLICY "Admins can manage feature flags" ON feature_flags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() AND user_role = 'admin'
    )
  );

-- Create function to update flag count on parts
CREATE OR REPLACE FUNCTION update_part_flag_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE parts 
    SET 
      flag_count = flag_count + 1,
      is_flagged = true,
      flag_reason = NEW.reason
    WHERE id = NEW.part_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'pending' AND NEW.status != 'pending' THEN
      UPDATE parts 
      SET flag_count = GREATEST(flag_count - 1, 0)
      WHERE id = NEW.part_id;
      
      -- Check if there are any remaining pending flags
      IF NOT EXISTS (
        SELECT 1 FROM part_flags 
        WHERE part_id = NEW.part_id AND status = 'pending'
      ) THEN
        UPDATE parts 
        SET is_flagged = false, flag_reason = NULL
        WHERE id = NEW.part_id;
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE parts 
    SET flag_count = GREATEST(flag_count - 1, 0)
    WHERE id = OLD.part_id;
    
    -- Check if there are any remaining pending flags
    IF NOT EXISTS (
      SELECT 1 FROM part_flags 
      WHERE part_id = OLD.part_id AND status = 'pending'
    ) THEN
      UPDATE parts 
      SET is_flagged = false, flag_reason = NULL
      WHERE id = OLD.part_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for flag count updates
CREATE TRIGGER trigger_update_part_flag_count
  AFTER INSERT OR UPDATE OR DELETE ON part_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_part_flag_count();

-- Insert default configuration data
INSERT INTO category_commissions (category, commission_percentage, is_active) VALUES
  ('mobile_phones', 5.0, true),
  ('phone_parts', 3.0, true),
  ('phone_accessories', 4.0, true),
  ('laptops', 6.0, true),
  ('steam_kits', 2.0, true),
  ('other_electronics', 5.0, true)
ON CONFLICT (category) DO NOTHING;

INSERT INTO escrow_settings (category, escrow_required, escrow_duration_days) VALUES
  ('mobile_phones', true, 7),
  ('phone_parts', true, 3),
  ('phone_accessories', true, 3),
  ('laptops', true, 10),
  ('steam_kits', false, 0),
  ('other_electronics', true, 5)
ON CONFLICT (category) DO NOTHING;

INSERT INTO global_settings (setting_key, setting_value, setting_type, description) VALUES
  ('moq_floor_screens', '10', 'number', 'Minimum order quantity floor for screen parts'),
  ('moq_floor_batteries', '5', 'number', 'Minimum order quantity floor for battery parts'),
  ('max_listing_price', '10000', 'number', 'Maximum price allowed for a single listing'),
  ('auto_approve_listings', 'false', 'boolean', 'Automatically approve new listings without admin review'),
  ('require_fica_for_selling', 'true', 'boolean', 'Require FICA verification before users can sell')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO feature_flags (flag_name, flag_value, description) VALUES
  ('enable_chat_feature', true, 'Enable real-time chat between buyers and sellers'),
  ('enable_escrow_system', true, 'Enable escrow system for payments'),
  ('enable_commission_system', true, 'Enable commission system for platform revenue'),
  ('enable_auto_approval', false, 'Automatically approve listings without manual review'),
  ('enable_advanced_search', true, 'Enable advanced search filters and sorting'),
  ('enable_review_system', true, 'Enable product and seller review system')
ON CONFLICT (flag_name) DO NOTHING;
