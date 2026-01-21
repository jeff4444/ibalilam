-- 021: atomic_withdrawal_approve function
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
