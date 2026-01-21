-- 017: admin_wallet_adjustment function
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
  SELECT EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid() AND is_active = true) INTO v_is_admin;
  IF NOT v_is_admin THEN RAISE EXCEPTION 'Only admins can make wallet adjustments'; END IF;
  v_wallet_id := get_or_create_wallet(p_user_id);
  UPDATE user_wallets SET available_balance = available_balance + p_amount, updated_at = NOW()
  WHERE id = v_wallet_id RETURNING available_balance INTO v_new_balance;
  INSERT INTO wallet_transactions (wallet_id, transaction_type, amount, status, reference_type, description, balance_after)
  VALUES (v_wallet_id, 'adjustment', p_amount, 'completed', 'manual', p_description, v_new_balance)
  RETURNING id INTO v_transaction_id;
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
