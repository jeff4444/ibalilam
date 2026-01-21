-- 025: release_escrow_funds function
CREATE OR REPLACE FUNCTION release_escrow_funds(p_shop_id UUID, p_amount DECIMAL(18,2))
RETURNS BOOLEAN AS $$
DECLARE
  v_locked_balance DECIMAL(18,2);
BEGIN
  SELECT locked_balance INTO v_locked_balance FROM shops WHERE id = p_shop_id FOR UPDATE;
  IF v_locked_balance < p_amount THEN p_amount := v_locked_balance; END IF;
  UPDATE shops SET locked_balance = locked_balance - p_amount,
    available_balance = available_balance + p_amount, updated_at = NOW()
  WHERE id = p_shop_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
