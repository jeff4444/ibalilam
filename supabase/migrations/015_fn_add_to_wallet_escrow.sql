-- 015: add_to_wallet_escrow function
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
  UPDATE user_wallets SET locked_balance = locked_balance + p_amount, updated_at = NOW()
  WHERE id = v_wallet_id RETURNING locked_balance INTO v_new_locked_balance;
  INSERT INTO wallet_transactions (wallet_id, transaction_type, amount, status, reference_id,
    reference_type, description, balance_after)
  VALUES (v_wallet_id, 'escrow_hold', p_amount, 'completed', p_order_id, 'order', p_description, v_new_locked_balance)
  RETURNING id INTO v_transaction_id;
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
