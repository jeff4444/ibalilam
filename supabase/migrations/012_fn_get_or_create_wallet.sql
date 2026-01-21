-- 012: get_or_create_wallet function
CREATE OR REPLACE FUNCTION get_or_create_wallet(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  SELECT id INTO v_wallet_id FROM user_wallets WHERE user_id = p_user_id;
  IF v_wallet_id IS NULL THEN
    INSERT INTO user_wallets (user_id) VALUES (p_user_id) RETURNING id INTO v_wallet_id;
  END IF;
  RETURN v_wallet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
