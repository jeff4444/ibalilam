-- 013: record_wallet_deposit function
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
  UPDATE user_wallets SET available_balance = available_balance + p_amount,
    total_deposited = total_deposited + p_amount, updated_at = NOW()
  WHERE id = v_wallet_id RETURNING available_balance INTO v_new_balance;
  INSERT INTO wallet_transactions (wallet_id, transaction_type, amount, status, reference_type,
    description, balance_after, payfast_payment_id)
  VALUES (v_wallet_id, 'deposit', p_amount, 'completed', 'payfast', p_description, v_new_balance, p_payfast_payment_id)
  RETURNING id INTO v_transaction_id;
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
