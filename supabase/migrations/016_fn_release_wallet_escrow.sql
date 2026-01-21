-- 016: release_wallet_escrow function
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
  SELECT id, locked_balance INTO v_wallet_id, v_current_locked FROM user_wallets WHERE user_id = p_seller_user_id;
  IF v_wallet_id IS NULL THEN RAISE EXCEPTION 'Wallet not found for seller'; END IF;
  v_release_amount := LEAST(p_amount, v_current_locked);
  IF v_release_amount <= 0 THEN RAISE EXCEPTION 'No funds available in escrow'; END IF;
  UPDATE user_wallets SET locked_balance = locked_balance - v_release_amount,
    available_balance = available_balance + v_release_amount, updated_at = NOW()
  WHERE id = v_wallet_id RETURNING available_balance INTO v_new_available;
  INSERT INTO wallet_transactions (wallet_id, transaction_type, amount, status, reference_id,
    reference_type, description, balance_after)
  VALUES (v_wallet_id, 'escrow_release', v_release_amount, 'completed', p_order_id, 'order', p_description, v_new_available)
  RETURNING id INTO v_transaction_id;
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
