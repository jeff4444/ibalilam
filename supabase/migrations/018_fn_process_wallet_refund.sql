-- 018: process_wallet_refund function
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
  UPDATE user_wallets SET available_balance = available_balance + p_amount, updated_at = NOW()
  WHERE id = v_wallet_id RETURNING available_balance INTO v_new_balance;
  INSERT INTO wallet_transactions (wallet_id, transaction_type, amount, status, reference_id,
    reference_type, description, balance_after)
  VALUES (v_wallet_id, 'refund', p_amount, 'completed', p_order_id, 'order', p_description, v_new_balance)
  RETURNING id INTO v_transaction_id;
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
