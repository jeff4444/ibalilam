-- Create user wallets system for managing user balances, deposits, and withdrawals
-- This replaces shop-level balance tracking with user-level wallet system

-- =============================================
-- 1. CREATE USER_WALLETS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS user_wallets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  available_balance DECIMAL(10,2) DEFAULT 0.00 NOT NULL,
  locked_balance DECIMAL(10,2) DEFAULT 0.00 NOT NULL,
  total_deposited DECIMAL(10,2) DEFAULT 0.00 NOT NULL,
  total_withdrawn DECIMAL(10,2) DEFAULT 0.00 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure balances cannot go negative
  CONSTRAINT chk_wallet_available_balance_non_negative CHECK (available_balance >= 0),
  CONSTRAINT chk_wallet_locked_balance_non_negative CHECK (locked_balance >= 0),
  CONSTRAINT chk_wallet_total_deposited_non_negative CHECK (total_deposited >= 0),
  CONSTRAINT chk_wallet_total_withdrawn_non_negative CHECK (total_withdrawn >= 0)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON user_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_wallets_available_balance ON user_wallets(available_balance);

-- =============================================
-- 2. CREATE WALLET_TRANSACTIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID REFERENCES user_wallets(id) ON DELETE CASCADE NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'deposit',           -- User adds funds via PayFast
    'withdrawal',        -- User withdraws to bank via PayFast payout
    'escrow_hold',       -- Funds held from a sale (pending delivery)
    'escrow_release',    -- Funds released after delivery confirmed
    'sale_credit',       -- Direct credit from a sale (already net of commission)
    'commission_deduction', -- Commission taken on a sale
    'refund',            -- Refund to buyer
    'adjustment'         -- Manual admin adjustment
  )),
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  reference_id UUID,    -- Links to order_id, payout_id, etc.
  reference_type TEXT CHECK (reference_type IN ('order', 'payfast', 'manual', 'payout')),
  description TEXT,
  balance_after DECIMAL(10,2), -- Running balance after this transaction
  payfast_payment_id TEXT,     -- For PayFast transactions
  payfast_payout_batch_id TEXT, -- For PayFast payouts
  metadata JSONB DEFAULT '{}', -- Additional transaction metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Amount cannot be zero
  CONSTRAINT chk_wallet_transaction_amount_non_zero CHECK (amount != 0)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_status ON wallet_transactions(status);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference ON wallet_transactions(reference_id, reference_type);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_payfast ON wallet_transactions(payfast_payment_id);

-- =============================================
-- 3. ENABLE ROW LEVEL SECURITY
-- =============================================
ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- User wallet policies
CREATE POLICY "Users can view their own wallet" ON user_wallets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert wallets" ON user_wallets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wallet" ON user_wallets
  FOR UPDATE USING (auth.uid() = user_id);

-- Admins can view all wallets
CREATE POLICY "Admins can view all wallets" ON user_wallets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Admins can update all wallets (for adjustments)
CREATE POLICY "Admins can update all wallets" ON user_wallets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Wallet transaction policies
CREATE POLICY "Users can view their own transactions" ON wallet_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_wallets 
      WHERE id = wallet_transactions.wallet_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert transactions" ON wallet_transactions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_wallets 
      WHERE id = wallet_transactions.wallet_id AND user_id = auth.uid()
    )
  );

-- Admins can view all transactions
CREATE POLICY "Admins can view all wallet transactions" ON wallet_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Admins can insert transactions (for adjustments)
CREATE POLICY "Admins can insert wallet transactions" ON wallet_transactions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- =============================================
-- 4. CREATE TRIGGERS
-- =============================================

-- Auto-update updated_at timestamp
CREATE TRIGGER update_user_wallets_updated_at
  BEFORE UPDATE ON user_wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallet_transactions_updated_at
  BEFORE UPDATE ON wallet_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 5. ADD GLOBAL SETTINGS
-- =============================================
INSERT INTO global_settings (setting_key, setting_value, setting_type, description) VALUES
  ('escrow_auto_release_days', '7', 'number', 'Number of days after which escrow is automatically released if no dispute'),
  ('min_withdrawal_amount', '100.00', 'number', 'Minimum amount required for withdrawal (in ZAR)'),
  ('max_withdrawal_amount', '50000.00', 'number', 'Maximum amount allowed per withdrawal (in ZAR)')
ON CONFLICT (setting_key) DO NOTHING;

-- =============================================
-- 6. CREATE HELPER FUNCTIONS
-- =============================================

-- Function to get or create a user's wallet
CREATE OR REPLACE FUNCTION get_or_create_wallet(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  -- Try to get existing wallet
  SELECT id INTO v_wallet_id
  FROM user_wallets
  WHERE user_id = p_user_id;
  
  -- If no wallet exists, create one
  IF v_wallet_id IS NULL THEN
    INSERT INTO user_wallets (user_id)
    VALUES (p_user_id)
    RETURNING id INTO v_wallet_id;
  END IF;
  
  RETURN v_wallet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record a wallet deposit
CREATE OR REPLACE FUNCTION record_wallet_deposit(
  p_user_id UUID,
  p_amount DECIMAL(10,2),
  p_payfast_payment_id TEXT,
  p_description TEXT DEFAULT 'Wallet deposit via PayFast'
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_transaction_id UUID;
  v_new_balance DECIMAL(10,2);
BEGIN
  -- Get or create wallet
  v_wallet_id := get_or_create_wallet(p_user_id);
  
  -- Update wallet balance
  UPDATE user_wallets
  SET 
    available_balance = available_balance + p_amount,
    total_deposited = total_deposited + p_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id
  RETURNING available_balance INTO v_new_balance;
  
  -- Create transaction record
  INSERT INTO wallet_transactions (
    wallet_id,
    transaction_type,
    amount,
    status,
    reference_type,
    description,
    balance_after,
    payfast_payment_id
  ) VALUES (
    v_wallet_id,
    'deposit',
    p_amount,
    'completed',
    'payfast',
    p_description,
    v_new_balance,
    p_payfast_payment_id
  ) RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record a wallet withdrawal
CREATE OR REPLACE FUNCTION record_wallet_withdrawal(
  p_user_id UUID,
  p_amount DECIMAL(10,2),
  p_payfast_payout_id TEXT DEFAULT NULL,
  p_description TEXT DEFAULT 'Wallet withdrawal via PayFast'
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_transaction_id UUID;
  v_current_balance DECIMAL(10,2);
  v_new_balance DECIMAL(10,2);
BEGIN
  -- Get wallet
  SELECT id, available_balance INTO v_wallet_id, v_current_balance
  FROM user_wallets
  WHERE user_id = p_user_id;
  
  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for user';
  END IF;
  
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance for withdrawal';
  END IF;
  
  -- Update wallet balance
  UPDATE user_wallets
  SET 
    available_balance = available_balance - p_amount,
    total_withdrawn = total_withdrawn + p_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id
  RETURNING available_balance INTO v_new_balance;
  
  -- Create transaction record (pending until PayFast confirms)
  INSERT INTO wallet_transactions (
    wallet_id,
    transaction_type,
    amount,
    status,
    reference_type,
    description,
    balance_after,
    payfast_payout_batch_id
  ) VALUES (
    v_wallet_id,
    'withdrawal',
    -p_amount, -- Negative for outgoing
    'pending',
    'payout',
    p_description,
    v_new_balance,
    p_payfast_payout_id
  ) RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add funds to escrow (when a sale is made)
CREATE OR REPLACE FUNCTION add_to_wallet_escrow(
  p_seller_user_id UUID,
  p_amount DECIMAL(10,2),
  p_order_id UUID,
  p_description TEXT DEFAULT 'Sale payment held in escrow'
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_transaction_id UUID;
  v_new_locked_balance DECIMAL(10,2);
BEGIN
  -- Get or create seller's wallet
  v_wallet_id := get_or_create_wallet(p_seller_user_id);
  
  -- Update locked balance
  UPDATE user_wallets
  SET 
    locked_balance = locked_balance + p_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id
  RETURNING locked_balance INTO v_new_locked_balance;
  
  -- Create transaction record
  INSERT INTO wallet_transactions (
    wallet_id,
    transaction_type,
    amount,
    status,
    reference_id,
    reference_type,
    description,
    balance_after
  ) VALUES (
    v_wallet_id,
    'escrow_hold',
    p_amount,
    'completed',
    p_order_id,
    'order',
    p_description,
    v_new_locked_balance
  ) RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to release funds from escrow to available balance
CREATE OR REPLACE FUNCTION release_wallet_escrow(
  p_seller_user_id UUID,
  p_amount DECIMAL(10,2),
  p_order_id UUID,
  p_description TEXT DEFAULT 'Escrow released - delivery confirmed'
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_transaction_id UUID;
  v_current_locked DECIMAL(10,2);
  v_new_available DECIMAL(10,2);
  v_release_amount DECIMAL(10,2);
BEGIN
  -- Get seller's wallet
  SELECT id, locked_balance INTO v_wallet_id, v_current_locked
  FROM user_wallets
  WHERE user_id = p_seller_user_id;
  
  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for seller';
  END IF;
  
  -- Handle case where locked balance might be slightly off
  v_release_amount := LEAST(p_amount, v_current_locked);
  
  IF v_release_amount <= 0 THEN
    RAISE EXCEPTION 'No funds available in escrow';
  END IF;
  
  -- Transfer from locked to available
  UPDATE user_wallets
  SET 
    locked_balance = locked_balance - v_release_amount,
    available_balance = available_balance + v_release_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id
  RETURNING available_balance INTO v_new_available;
  
  -- Create transaction record
  INSERT INTO wallet_transactions (
    wallet_id,
    transaction_type,
    amount,
    status,
    reference_id,
    reference_type,
    description,
    balance_after
  ) VALUES (
    v_wallet_id,
    'escrow_release',
    v_release_amount,
    'completed',
    p_order_id,
    'order',
    p_description,
    v_new_available
  ) RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for admin to make wallet adjustments
CREATE OR REPLACE FUNCTION admin_wallet_adjustment(
  p_user_id UUID,
  p_amount DECIMAL(10,2),
  p_description TEXT
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_transaction_id UUID;
  v_new_balance DECIMAL(10,2);
  v_is_admin BOOLEAN;
BEGIN
  -- Verify caller is admin
  SELECT is_admin INTO v_is_admin
  FROM user_profiles
  WHERE user_id = auth.uid();
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only admins can make wallet adjustments';
  END IF;
  
  -- Get or create wallet
  v_wallet_id := get_or_create_wallet(p_user_id);
  
  -- Update wallet balance
  UPDATE user_wallets
  SET 
    available_balance = available_balance + p_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id
  RETURNING available_balance INTO v_new_balance;
  
  -- Create transaction record
  INSERT INTO wallet_transactions (
    wallet_id,
    transaction_type,
    amount,
    status,
    reference_type,
    description,
    balance_after
  ) VALUES (
    v_wallet_id,
    'adjustment',
    p_amount,
    'completed',
    'manual',
    p_description,
    v_new_balance
  ) RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process refund to buyer's wallet
CREATE OR REPLACE FUNCTION process_wallet_refund(
  p_buyer_user_id UUID,
  p_amount DECIMAL(10,2),
  p_order_id UUID,
  p_description TEXT DEFAULT 'Order refund'
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_transaction_id UUID;
  v_new_balance DECIMAL(10,2);
BEGIN
  -- Get or create buyer's wallet
  v_wallet_id := get_or_create_wallet(p_buyer_user_id);
  
  -- Add refund to available balance
  UPDATE user_wallets
  SET 
    available_balance = available_balance + p_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id
  RETURNING available_balance INTO v_new_balance;
  
  -- Create transaction record
  INSERT INTO wallet_transactions (
    wallet_id,
    transaction_type,
    amount,
    status,
    reference_id,
    reference_type,
    description,
    balance_after
  ) VALUES (
    v_wallet_id,
    'refund',
    p_amount,
    'completed',
    p_order_id,
    'order',
    p_description,
    v_new_balance
  ) RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 7. GRANT PERMISSIONS
-- =============================================
GRANT EXECUTE ON FUNCTION get_or_create_wallet(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION record_wallet_deposit(UUID, DECIMAL, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION record_wallet_withdrawal(UUID, DECIMAL, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION add_to_wallet_escrow(UUID, DECIMAL, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION release_wallet_escrow(UUID, DECIMAL, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_wallet_adjustment(UUID, DECIMAL, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION process_wallet_refund(UUID, DECIMAL, UUID, TEXT) TO authenticated;

-- =============================================
-- 8. ADD COMMENTS
-- =============================================
COMMENT ON TABLE user_wallets IS 'User wallet balances - available and locked (escrow) funds';
COMMENT ON TABLE wallet_transactions IS 'All wallet transaction history including deposits, withdrawals, and escrow movements';
COMMENT ON COLUMN user_wallets.available_balance IS 'Funds available for withdrawal';
COMMENT ON COLUMN user_wallets.locked_balance IS 'Funds held in escrow pending delivery confirmation';
COMMENT ON COLUMN user_wallets.total_deposited IS 'Lifetime total deposits made';
COMMENT ON COLUMN user_wallets.total_withdrawn IS 'Lifetime total withdrawals made';
COMMENT ON FUNCTION get_or_create_wallet IS 'Gets existing wallet or creates new one for user';
COMMENT ON FUNCTION record_wallet_deposit IS 'Records a deposit from PayFast into user wallet';
COMMENT ON FUNCTION record_wallet_withdrawal IS 'Records a withdrawal request from wallet';
COMMENT ON FUNCTION add_to_wallet_escrow IS 'Adds sale funds to seller wallet escrow';
COMMENT ON FUNCTION release_wallet_escrow IS 'Releases escrow funds to available balance after delivery';

