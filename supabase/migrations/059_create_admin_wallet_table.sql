-- Create admin wallet system for tracking platform finances
-- This includes commissions earned, escrow management, and payout tracking

-- Create admin_wallet_transactions table
CREATE TABLE IF NOT EXISTS admin_wallet_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_type TEXT CHECK (transaction_type IN ('commission', 'escrow_hold', 'escrow_release', 'payout', 'refund', 'adjustment')) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  reference_id UUID, -- Can reference order_id, transaction_id, or shop_id depending on type
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
  
  -- Balance tracking (running balance after this transaction)
  balance_after DECIMAL(10,2),
  
  -- Constraints
  CHECK (amount != 0)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admin_wallet_transactions_type ON admin_wallet_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_admin_wallet_transactions_status ON admin_wallet_transactions(status);
CREATE INDEX IF NOT EXISTS idx_admin_wallet_transactions_created_at ON admin_wallet_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_wallet_transactions_reference ON admin_wallet_transactions(reference_id, reference_type);
CREATE INDEX IF NOT EXISTS idx_admin_wallet_transactions_payout_shop ON admin_wallet_transactions(payout_to_shop_id);

-- Enable Row Level Security
ALTER TABLE admin_wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Only admins can access wallet transactions
CREATE POLICY "Admins can view all wallet transactions" ON admin_wallet_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins can insert wallet transactions" ON admin_wallet_transactions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins can update wallet transactions" ON admin_wallet_transactions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_admin_wallet_transactions_updated_at
  BEFORE UPDATE ON admin_wallet_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert platform balance settings into global_settings if they don't exist
INSERT INTO global_settings (setting_key, setting_value, setting_type, description) VALUES
  ('platform_available_balance', '0.00', 'number', 'Platform available balance (commissions ready for withdrawal)'),
  ('platform_locked_balance', '0.00', 'number', 'Platform locked balance (funds held in escrow)'),
  ('platform_total_commissions', '0.00', 'number', 'Total commissions earned by platform'),
  ('platform_total_payouts', '0.00', 'number', 'Total payouts made to sellers')
ON CONFLICT (setting_key) DO NOTHING;

-- Function to record commission and update platform balance
CREATE OR REPLACE FUNCTION record_platform_commission(
  p_amount DECIMAL(10,2),
  p_order_id UUID,
  p_description TEXT DEFAULT 'Commission from order'
)
RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_current_balance DECIMAL(10,2);
  v_new_balance DECIMAL(10,2);
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
  p_amount DECIMAL(10,2),
  p_method TEXT DEFAULT 'bank_transfer',
  p_reference TEXT DEFAULT NULL,
  p_description TEXT DEFAULT 'Payout to seller'
)
RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_current_balance DECIMAL(10,2);
  v_new_balance DECIMAL(10,2);
  v_shop_balance DECIMAL(10,2);
BEGIN
  -- Check shop available balance
  SELECT available_balance INTO v_shop_balance
  FROM shops
  WHERE id = p_shop_id;
  
  IF v_shop_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient shop balance for payout';
  END IF;
  
  -- Get current platform balance (this is optional tracking)
  SELECT COALESCE(setting_value::DECIMAL, 0) INTO v_current_balance
  FROM global_settings
  WHERE setting_key = 'platform_available_balance';
  
  v_new_balance := v_current_balance; -- Platform balance doesn't change on seller payout
  
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
    -p_amount, -- Negative for outgoing
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION record_platform_commission(DECIMAL, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION record_seller_payout(UUID, DECIMAL, TEXT, TEXT, TEXT) TO authenticated;

-- Add comments
COMMENT ON TABLE admin_wallet_transactions IS 'Tracks all platform financial transactions including commissions and payouts';
COMMENT ON FUNCTION record_platform_commission IS 'Records commission earned from an order';
COMMENT ON FUNCTION record_seller_payout IS 'Records payout made to a seller shop';

