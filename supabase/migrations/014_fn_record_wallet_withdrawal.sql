-- 014: record_wallet_withdrawal function
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
  SELECT id, available_balance INTO v_wallet_id, v_current_balance FROM user_wallets WHERE user_id = p_user_id;
  IF v_wallet_id IS NULL THEN RAISE EXCEPTION 'Wallet not found for user'; END IF;
  IF v_current_balance < p_amount THEN RAISE EXCEPTION 'Insufficient balance for withdrawal'; END IF;
  UPDATE user_wallets SET available_balance = available_balance - p_amount,
    total_withdrawn = total_withdrawn + p_amount, updated_at = NOW()
  WHERE id = v_wallet_id RETURNING available_balance INTO v_new_balance;
  INSERT INTO wallet_transactions (wallet_id, transaction_type, amount, status, reference_type,
    description, balance_after, payfast_payout_batch_id)
  VALUES (v_wallet_id, 'withdrawal', -p_amount, 'pending', 'payout', p_description, v_new_balance, p_payfast_payout_id)
  RETURNING id INTO v_transaction_id;
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
