-- 020: atomic_escrow_release function
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
  UPDATE user_wallets SET locked_balance = locked_balance - v_release_amount,
    available_balance = available_balance + v_release_amount, updated_at = NOW()
  WHERE id = v_wallet_id RETURNING available_balance INTO v_new_available;
  UPDATE shops SET locked_balance = GREATEST(0, locked_balance - v_release_amount),
    available_balance = available_balance + v_release_amount, updated_at = NOW()
  WHERE id = p_shop_id;
  INSERT INTO wallet_transactions (wallet_id, transaction_type, amount, status, reference_id,
    reference_type, description, balance_after, metadata)
  VALUES (v_wallet_id, 'escrow_release', v_release_amount, 'completed', p_order_id, 'order', p_description, v_new_available,
    jsonb_build_object('shop_id', p_shop_id, 'atomic_operation', 'escrow_release',
      'requested_amount', p_amount, 'actual_released', v_release_amount, 'processed_at', NOW()))
  RETURNING id INTO v_transaction_id;
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
