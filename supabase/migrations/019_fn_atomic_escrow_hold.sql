-- 019: atomic_escrow_hold function
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
  UPDATE shops SET locked_balance = locked_balance + p_amount, updated_at = NOW() WHERE id = p_shop_id;
  INSERT INTO wallet_transactions (wallet_id, transaction_type, amount, status, reference_id,
    reference_type, description, balance_after, metadata)
  VALUES (v_wallet_id, 'escrow_hold', p_amount, 'completed', p_order_id, 'order', p_description, v_new_locked_balance,
    jsonb_build_object('shop_id', p_shop_id, 'atomic_operation', 'escrow_hold', 'processed_at', NOW()))
  RETURNING id INTO v_transaction_id;
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
