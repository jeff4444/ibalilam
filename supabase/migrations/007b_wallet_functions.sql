-- ============================================================
-- 007b_wallet_functions.sql
-- Wallet helper functions
-- ============================================================

-- Function to get or create a user's wallet
CREATE OR REPLACE FUNCTION get_or_create_wallet(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  SELECT id INTO v_wallet_id FROM user_wallets WHERE user_id = p_user_id;
  
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
  p_amount DECIMAL(18,2),
  p_payfast_payment_id TEXT,
  p_description TEXT DEFAULT 'Wallet deposit via PayFast'
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_transaction_id UUID;
  v_new_balance DECIMAL(18,2);
BEGIN
  v_wallet_id := get_or_create_wallet(p_user_id);
  
  UPDATE user_wallets
  SET 
    available_balance = available_balance + p_amount,
    total_deposited = total_deposited + p_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id
  RETURNING available_balance INTO v_new_balance;
  
  INSERT INTO wallet_transactions (
    wallet_id, transaction_type, amount, status, reference_type,
    description, balance_after, payfast_payment_id
  ) VALUES (
    v_wallet_id, 'deposit', p_amount, 'completed', 'payfast',
    p_description, v_new_balance, p_payfast_payment_id
  ) RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record a wallet withdrawal
CREATE OR REPLACE FUNCTION record_wallet_withdrawal(
  p_user_id UUID,
  p_amount DECIMAL(18,2),
  p_payfast_payout_id TEXT DEFAULT NULL,
  p_description TEXT DEFAULT 'Wallet withdrawal via PayFast'
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_transaction_id UUID;
  v_current_balance DECIMAL(18,2);
  v_new_balance DECIMAL(18,2);
BEGIN
  SELECT id, available_balance INTO v_wallet_id, v_current_balance
  FROM user_wallets WHERE user_id = p_user_id;
  
  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for user';
  END IF;
  
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance for withdrawal';
  END IF;
  
  UPDATE user_wallets
  SET 
    available_balance = available_balance - p_amount,
    total_withdrawn = total_withdrawn + p_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id
  RETURNING available_balance INTO v_new_balance;
  
  INSERT INTO wallet_transactions (
    wallet_id, transaction_type, amount, status, reference_type,
    description, balance_after, payfast_payout_batch_id
  ) VALUES (
    v_wallet_id, 'withdrawal', -p_amount, 'pending', 'payout',
    p_description, v_new_balance, p_payfast_payout_id
  ) RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add funds to escrow
CREATE OR REPLACE FUNCTION add_to_wallet_escrow(
  p_seller_user_id UUID,
  p_amount DECIMAL(18,2),
  p_order_id UUID,
  p_description TEXT DEFAULT 'Sale payment held in escrow'
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_transaction_id UUID;
  v_new_locked_balance DECIMAL(18,2);
BEGIN
  v_wallet_id := get_or_create_wallet(p_seller_user_id);
  
  UPDATE user_wallets
  SET locked_balance = locked_balance + p_amount, updated_at = NOW()
  WHERE id = v_wallet_id
  RETURNING locked_balance INTO v_new_locked_balance;
  
  INSERT INTO wallet_transactions (
    wallet_id, transaction_type, amount, status, reference_id,
    reference_type, description, balance_after
  ) VALUES (
    v_wallet_id, 'escrow_hold', p_amount, 'completed', p_order_id,
    'order', p_description, v_new_locked_balance
  ) RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to release funds from escrow
CREATE OR REPLACE FUNCTION release_wallet_escrow(
  p_seller_user_id UUID,
  p_amount DECIMAL(18,2),
  p_order_id UUID,
  p_description TEXT DEFAULT 'Escrow released - delivery confirmed'
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_transaction_id UUID;
  v_current_locked DECIMAL(18,2);
  v_new_available DECIMAL(18,2);
  v_release_amount DECIMAL(18,2);
BEGIN
  SELECT id, locked_balance INTO v_wallet_id, v_current_locked
  FROM user_wallets WHERE user_id = p_seller_user_id;
  
  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for seller';
  END IF;
  
  v_release_amount := LEAST(p_amount, v_current_locked);
  
  IF v_release_amount <= 0 THEN
    RAISE EXCEPTION 'No funds available in escrow';
  END IF;
  
  UPDATE user_wallets
  SET 
    locked_balance = locked_balance - v_release_amount,
    available_balance = available_balance + v_release_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id
  RETURNING available_balance INTO v_new_available;
  
  INSERT INTO wallet_transactions (
    wallet_id, transaction_type, amount, status, reference_id,
    reference_type, description, balance_after
  ) VALUES (
    v_wallet_id, 'escrow_release', v_release_amount, 'completed', p_order_id,
    'order', p_description, v_new_available
  ) RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for admin wallet adjustments
CREATE OR REPLACE FUNCTION admin_wallet_adjustment(
  p_user_id UUID,
  p_amount DECIMAL(18,2),
  p_description TEXT
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_transaction_id UUID;
  v_new_balance DECIMAL(18,2);
  v_is_admin BOOLEAN;
BEGIN
  -- Check admin status from admins table (secure - can only be modified via service_role)
  SELECT EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
    AND is_active = true
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only admins can make wallet adjustments';
  END IF;
  
  v_wallet_id := get_or_create_wallet(p_user_id);
  
  UPDATE user_wallets
  SET available_balance = available_balance + p_amount, updated_at = NOW()
  WHERE id = v_wallet_id
  RETURNING available_balance INTO v_new_balance;
  
  INSERT INTO wallet_transactions (
    wallet_id, transaction_type, amount, status, reference_type, description, balance_after
  ) VALUES (
    v_wallet_id, 'adjustment', p_amount, 'completed', 'manual', p_description, v_new_balance
  ) RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process refund to buyer's wallet
CREATE OR REPLACE FUNCTION process_wallet_refund(
  p_buyer_user_id UUID,
  p_amount DECIMAL(18,2),
  p_order_id UUID,
  p_description TEXT DEFAULT 'Order refund'
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_transaction_id UUID;
  v_new_balance DECIMAL(18,2);
BEGIN
  v_wallet_id := get_or_create_wallet(p_buyer_user_id);
  
  UPDATE user_wallets
  SET available_balance = available_balance + p_amount, updated_at = NOW()
  WHERE id = v_wallet_id
  RETURNING available_balance INTO v_new_balance;
  
  INSERT INTO wallet_transactions (
    wallet_id, transaction_type, amount, status, reference_id,
    reference_type, description, balance_after
  ) VALUES (
    v_wallet_id, 'refund', p_amount, 'completed', p_order_id,
    'order', p_description, v_new_balance
  ) RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
