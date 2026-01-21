-- ============================================================
-- 006_admin_system.sql
-- Admin tables, settings, and configuration
-- ============================================================

-- ============================================================
-- CATEGORY_COMMISSIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS category_commissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  commission_percentage DECIMAL(5,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT chk_commission_percentage_range CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
  UNIQUE(category)
);

-- Enable RLS
ALTER TABLE category_commissions ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at
CREATE TRIGGER update_category_commissions_updated_at
  BEFORE UPDATE ON category_commissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ESCROW_SETTINGS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS escrow_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  escrow_required BOOLEAN DEFAULT true,
  escrow_duration_days INTEGER DEFAULT 7,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT chk_escrow_duration_non_negative CHECK (escrow_duration_days >= 0),
  UNIQUE(category)
);

-- Enable RLS
ALTER TABLE escrow_settings ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at
CREATE TRIGGER update_escrow_settings_updated_at
  BEFORE UPDATE ON escrow_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- GLOBAL_SETTINGS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS global_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  setting_type TEXT CHECK (setting_type IN ('string', 'number', 'boolean', 'json')) DEFAULT 'string',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at
CREATE TRIGGER update_global_settings_updated_at
  BEFORE UPDATE ON global_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- FEATURE_FLAGS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  flag_name TEXT NOT NULL UNIQUE,
  flag_value BOOLEAN DEFAULT false,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at
CREATE TRIGGER update_feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- PART_FLAGS TABLE
-- ============================================================

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_part_flags_part_id ON part_flags(part_id);
CREATE INDEX IF NOT EXISTS idx_part_flags_reporter_id ON part_flags(reporter_id);
CREATE INDEX IF NOT EXISTS idx_part_flags_status ON part_flags(status);

-- Enable RLS
ALTER TABLE part_flags ENABLE ROW LEVEL SECURITY;

-- Function to update flag count on parts
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

-- Trigger for flag count updates
CREATE TRIGGER trigger_update_part_flag_count
  AFTER INSERT OR UPDATE OR DELETE ON part_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_part_flag_count();

-- ============================================================
-- ADMIN_WALLET_TRANSACTIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_wallet_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_type TEXT CHECK (transaction_type IN ('commission', 'escrow_hold', 'escrow_release', 'payout', 'refund', 'adjustment')) NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  reference_id UUID,
  reference_type TEXT CHECK (reference_type IN ('order', 'transaction', 'shop', 'manual')),
  description TEXT,
  status TEXT CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')) DEFAULT 'completed',
  
  -- For payouts
  payout_to_shop_id UUID REFERENCES shops(id) ON DELETE SET NULL,
  payout_method TEXT,
  payout_reference TEXT,
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Balance tracking
  balance_after DECIMAL(18,2),
  
  -- Constraints
  CONSTRAINT chk_admin_tx_amount_non_zero CHECK (amount != 0),
  CONSTRAINT chk_admin_tx_amount_max CHECK (ABS(amount) < 1000000000000.00)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_wallet_transactions_type ON admin_wallet_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_admin_wallet_transactions_status ON admin_wallet_transactions(status);
CREATE INDEX IF NOT EXISTS idx_admin_wallet_transactions_created_at ON admin_wallet_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_wallet_transactions_reference ON admin_wallet_transactions(reference_id, reference_type);
CREATE INDEX IF NOT EXISTS idx_admin_wallet_transactions_payout_shop ON admin_wallet_transactions(payout_to_shop_id);

-- Enable RLS
ALTER TABLE admin_wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at
CREATE TRIGGER update_admin_wallet_transactions_updated_at
  BEFORE UPDATE ON admin_wallet_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ADMIN WALLET FUNCTIONS
-- ============================================================

-- Function to record commission and update platform balance
CREATE OR REPLACE FUNCTION record_platform_commission(
  p_amount DECIMAL(18,2),
  p_order_id UUID,
  p_description TEXT DEFAULT 'Commission from order'
)
RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_current_balance DECIMAL(18,2);
  v_new_balance DECIMAL(18,2);
BEGIN
  -- Get current available balance
  SELECT COALESCE(setting_value::DECIMAL, 0) INTO v_current_balance
  FROM global_settings
  WHERE setting_key = 'platform_available_balance';
  
  v_new_balance := v_current_balance + p_amount;
  
  -- Insert transaction record
  INSERT INTO admin_wallet_transactions (
    transaction_type,
    amount,
    reference_id,
    reference_type,
    description,
    balance_after,
    created_by
  ) VALUES (
    'commission',
    p_amount,
    p_order_id,
    'order',
    p_description,
    v_new_balance,
    auth.uid()
  ) RETURNING id INTO v_transaction_id;
  
  -- Update platform balance
  UPDATE global_settings
  SET setting_value = v_new_balance::TEXT, updated_at = NOW()
  WHERE setting_key = 'platform_available_balance';
  
  -- Update total commissions
  UPDATE global_settings
  SET setting_value = (COALESCE(setting_value::DECIMAL, 0) + p_amount)::TEXT, updated_at = NOW()
  WHERE setting_key = 'platform_total_commissions';
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record payout to seller
CREATE OR REPLACE FUNCTION record_seller_payout(
  p_shop_id UUID,
  p_amount DECIMAL(18,2),
  p_method TEXT DEFAULT 'bank_transfer',
  p_reference TEXT DEFAULT NULL,
  p_description TEXT DEFAULT 'Payout to seller'
)
RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_current_balance DECIMAL(18,2);
  v_new_balance DECIMAL(18,2);
  v_shop_balance DECIMAL(18,2);
BEGIN
  -- Check shop available balance
  SELECT available_balance INTO v_shop_balance
  FROM shops
  WHERE id = p_shop_id;
  
  IF v_shop_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient shop balance for payout';
  END IF;
  
  -- Get current platform balance
  SELECT COALESCE(setting_value::DECIMAL, 0) INTO v_current_balance
  FROM global_settings
  WHERE setting_key = 'platform_available_balance';
  
  v_new_balance := v_current_balance;
  
  -- Insert transaction record
  INSERT INTO admin_wallet_transactions (
    transaction_type,
    amount,
    reference_id,
    reference_type,
    description,
    payout_to_shop_id,
    payout_method,
    payout_reference,
    balance_after,
    created_by
  ) VALUES (
    'payout',
    -p_amount,
    p_shop_id,
    'shop',
    p_description,
    p_shop_id,
    p_method,
    p_reference,
    v_new_balance,
    auth.uid()
  ) RETURNING id INTO v_transaction_id;
  
  -- Deduct from shop available balance
  UPDATE shops
  SET available_balance = available_balance - p_amount, updated_at = NOW()
  WHERE id = p_shop_id;
  
  -- Update total payouts
  UPDATE global_settings
  SET setting_value = (COALESCE(setting_value::DECIMAL, 0) + p_amount)::TEXT, updated_at = NOW()
  WHERE setting_key = 'platform_total_payouts';
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- DEFAULT DATA
-- ============================================================

-- Insert default category commissions
INSERT INTO category_commissions (category, commission_percentage, is_active) VALUES
  ('mobile_phones', 5.0, true),
  ('phone_parts', 3.0, true),
  ('phone_accessories', 4.0, true),
  ('laptops', 6.0, true),
  ('steam_kits', 2.0, true),
  ('other_electronics', 5.0, true)
ON CONFLICT (category) DO NOTHING;

-- Insert default escrow settings
INSERT INTO escrow_settings (category, escrow_required, escrow_duration_days) VALUES
  ('mobile_phones', true, 7),
  ('phone_parts', true, 3),
  ('phone_accessories', true, 3),
  ('laptops', true, 10),
  ('steam_kits', false, 0),
  ('other_electronics', true, 5)
ON CONFLICT (category) DO NOTHING;

-- Insert default global settings
INSERT INTO global_settings (setting_key, setting_value, setting_type, description) VALUES
  ('moq_floor_screens', '10', 'number', 'Minimum order quantity floor for screen parts'),
  ('moq_floor_batteries', '5', 'number', 'Minimum order quantity floor for battery parts'),
  ('max_listing_price', '10000', 'number', 'Maximum price allowed for a single listing'),
  ('auto_approve_listings', 'false', 'boolean', 'Automatically approve new listings without admin review'),
  ('require_fica_for_selling', 'true', 'boolean', 'Require FICA verification before users can sell'),
  ('escrow_auto_release_days', '7', 'number', 'Number of days after which escrow is automatically released if no dispute'),
  ('min_withdrawal_amount', '100.00', 'number', 'Minimum amount required for withdrawal (in ZAR)'),
  ('max_withdrawal_amount', '50000.00', 'number', 'Maximum amount allowed per withdrawal (in ZAR)'),
  ('platform_available_balance', '0.00', 'number', 'Platform available balance (commissions ready for withdrawal)'),
  ('platform_locked_balance', '0.00', 'number', 'Platform locked balance (funds held in escrow)'),
  ('platform_total_commissions', '0.00', 'number', 'Total commissions earned by platform'),
  ('platform_total_payouts', '0.00', 'number', 'Total payouts made to sellers'),
  ('vat_percentage', '15', 'number', 'VAT percentage applied to listings'),
  ('payfast_fee_percentage', '2.3', 'number', 'Payfast transaction fee percentage')
ON CONFLICT (setting_key) DO NOTHING;

-- Insert default feature flags
INSERT INTO feature_flags (flag_name, flag_value, description) VALUES
  ('enable_chat_feature', true, 'Enable real-time chat between buyers and sellers'),
  ('enable_escrow_system', true, 'Enable escrow system for payments'),
  ('enable_commission_system', true, 'Enable commission system for platform revenue'),
  ('enable_auto_approval', false, 'Automatically approve listings without manual review'),
  ('enable_advanced_search', true, 'Enable advanced search filters and sorting'),
  ('enable_review_system', true, 'Enable product and seller review system'),
  ('enable_vat_fees', false, 'Enable VAT fee calculation on listings'),
  ('enable_payfast_fees', true, 'Enable Payfast fee calculation on listings'),
  ('enable_become_seller', true, 'Enable users to become sellers')
ON CONFLICT (flag_name) DO NOTHING;

-- Comments
COMMENT ON TABLE admin_wallet_transactions IS 'Tracks all platform financial transactions including commissions and payouts';
COMMENT ON FUNCTION record_platform_commission IS 'Records commission earned from an order';
COMMENT ON FUNCTION record_seller_payout IS 'Records payout made to a seller shop';
