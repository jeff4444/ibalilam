-- ============================================================
-- 007c_wallet_atomic_functions.sql
-- Atomic wallet functions for dual balance sync
-- ============================================================

-- Atomic escrow hold function
CREATE OR REPLACE FUNCTION atomic_escrow_hold(
  p_seller_user_id UUID,
  p_shop_id UUID,
  p_amount DECIMAL(18,2),
  p_order_id UUID,
  p_description TEXT DEFAULT 'Sale payment held in escrow'
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_transaction_id UUID;
  v_new_locked_balance DECIMAL(18,2);
  v_existing_tx UUID;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF p_seller_user_id IS NULL OR p_shop_id IS NULL OR p_order_id IS NULL THEN
    RAISE EXCEPTION 'seller_user_id, shop_id, and order_id are required';
  END IF;

  SELECT id INTO v_existing_tx FROM wallet_transactions
  WHERE reference_id = p_order_id AND transaction_type = 'escrow_hold' AND status = 'completed';
  IF v_existing_tx IS NOT NULL THEN RETURN v_existing_tx; END IF;

  SELECT id INTO v_wallet_id FROM user_wallets WHERE user_id = p_seller_user_id FOR UPDATE;
  IF v_wallet_id IS NULL THEN
    INSERT INTO user_wallets (user_id, available_balance, locked_balance)
    VALUES (p_seller_user_id, 0, 0) RETURNING id INTO v_wallet_id;
  END IF;
  
  UPDATE user_wallets SET locked_balance = locked_balance + p_amount, updated_at = NOW()
  WHERE id = v_wallet_id RETURNING locked_balance INTO v_new_locked_balance;
  
  UPDATE shops SET locked_balance = locked_balance + p_amount, updated_at = NOW()
  WHERE id = p_shop_id;
  
  INSERT INTO wallet_transactions (
    wallet_id, transaction_type, amount, status, reference_id,
    reference_type, description, balance_after, metadata
  ) VALUES (
    v_wallet_id, 'escrow_hold', p_amount, 'completed', p_order_id,
    'order', p_description, v_new_locked_balance,
    jsonb_build_object('shop_id', p_shop_id, 'atomic_operation', 'escrow_hold', 'processed_at', NOW())
  ) RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic escrow release function
CREATE OR REPLACE FUNCTION atomic_escrow_release(
  p_seller_user_id UUID,
  p_shop_id UUID,
  p_amount DECIMAL(18,2),
  p_order_id UUID,
  p_description TEXT DEFAULT 'Escrow released - delivery confirmed'
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_transaction_id UUID;
  v_current_locked DECIMAL(18,2);
  v_release_amount DECIMAL(18,2);
  v_new_available DECIMAL(18,2);
  v_existing_tx UUID;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF p_seller_user_id IS NULL OR p_shop_id IS NULL OR p_order_id IS NULL THEN
    RAISE EXCEPTION 'seller_user_id, shop_id, and order_id are required';
  END IF;

  SELECT id INTO v_existing_tx FROM wallet_transactions
  WHERE reference_id = p_order_id AND transaction_type = 'escrow_release' AND status = 'completed';
  IF v_existing_tx IS NOT NULL THEN RETURN v_existing_tx; END IF;

  SELECT id, locked_balance INTO v_wallet_id, v_current_locked
  FROM user_wallets WHERE user_id = p_seller_user_id FOR UPDATE;
  IF v_wallet_id IS NULL THEN RAISE EXCEPTION 'Wallet not found for seller'; END IF;
  
  v_release_amount := LEAST(p_amount, v_current_locked);
  IF v_release_amount <= 0 THEN RAISE EXCEPTION 'No funds available in escrow to release'; END IF;
  
  UPDATE user_wallets SET 
    locked_balance = locked_balance - v_release_amount,
    available_balance = available_balance + v_release_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id RETURNING available_balance INTO v_new_available;
  
  UPDATE shops SET 
    locked_balance = GREATEST(0, locked_balance - v_release_amount),
    available_balance = available_balance + v_release_amount,
    updated_at = NOW()
  WHERE id = p_shop_id;
  
  INSERT INTO wallet_transactions (
    wallet_id, transaction_type, amount, status, reference_id,
    reference_type, description, balance_after, metadata
  ) VALUES (
    v_wallet_id, 'escrow_release', v_release_amount, 'completed', p_order_id,
    'order', p_description, v_new_available,
    jsonb_build_object('shop_id', p_shop_id, 'atomic_operation', 'escrow_release',
      'requested_amount', p_amount, 'actual_released', v_release_amount, 'processed_at', NOW())
  ) RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic withdrawal approval function
CREATE OR REPLACE FUNCTION atomic_withdrawal_approve(
  p_wallet_id UUID,
  p_amount DECIMAL(18,2),
  p_transaction_id UUID,
  p_admin_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_balance DECIMAL(18,2);
  v_new_balance DECIMAL(18,2);
  v_tx_status TEXT;
  v_shop_id UUID;
  v_user_id UUID;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF p_wallet_id IS NULL OR p_transaction_id IS NULL OR p_admin_id IS NULL THEN
    RAISE EXCEPTION 'wallet_id, transaction_id, and admin_id are required';
  END IF;

  SELECT status INTO v_tx_status FROM wallet_transactions WHERE id = p_transaction_id;
  IF v_tx_status IS NULL THEN RAISE EXCEPTION 'Transaction not found'; END IF;
  IF v_tx_status != 'pending' THEN RETURN v_tx_status = 'completed'; END IF;

  SELECT available_balance, user_id INTO v_current_balance, v_user_id
  FROM user_wallets WHERE id = p_wallet_id FOR UPDATE;
  IF v_current_balance IS NULL THEN RAISE EXCEPTION 'Wallet not found'; END IF;
  
  IF v_current_balance < p_amount THEN
    UPDATE wallet_transactions SET status = 'failed',
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'failure_reason', 'Insufficient balance', 'available_balance', v_current_balance,
        'requested_amount', p_amount, 'failed_at', NOW(), 'admin_id', p_admin_id),
      updated_at = NOW()
    WHERE id = p_transaction_id;
    RETURN FALSE;
  END IF;
  
  v_new_balance := v_current_balance - p_amount;
  
  UPDATE user_wallets SET available_balance = v_new_balance,
    total_withdrawn = total_withdrawn + p_amount, updated_at = NOW()
  WHERE id = p_wallet_id;
  
  SELECT id INTO v_shop_id FROM shops WHERE user_id = v_user_id;
  IF v_shop_id IS NOT NULL THEN
    UPDATE shops SET available_balance = GREATEST(0, available_balance - p_amount), updated_at = NOW()
    WHERE id = v_shop_id;
  END IF;
  
  UPDATE wallet_transactions SET status = 'completed', balance_after = v_new_balance,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'approved_by', p_admin_id, 'approved_at', NOW(),
      'atomic_operation', 'withdrawal_approve', 'shop_id', v_shop_id),
    updated_at = NOW()
  WHERE id = p_transaction_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic withdrawal rejection function
CREATE OR REPLACE FUNCTION atomic_withdrawal_reject(
  p_transaction_id UUID,
  p_admin_id UUID,
  p_rejection_reason TEXT DEFAULT 'Rejected by admin'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_tx_status TEXT;
BEGIN
  IF p_transaction_id IS NULL OR p_admin_id IS NULL THEN
    RAISE EXCEPTION 'transaction_id and admin_id are required';
  END IF;

  SELECT status INTO v_tx_status FROM wallet_transactions WHERE id = p_transaction_id FOR UPDATE;
  IF v_tx_status IS NULL THEN RAISE EXCEPTION 'Transaction not found'; END IF;
  IF v_tx_status != 'pending' THEN RETURN FALSE; END IF;
  
  UPDATE wallet_transactions SET status = 'failed',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'rejected_by', p_admin_id, 'rejected_at', NOW(), 'rejection_reason', p_rejection_reason),
    updated_at = NOW()
  WHERE id = p_transaction_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
