-- 026: add_to_locked_balance function
CREATE OR REPLACE FUNCTION add_to_locked_balance(p_shop_id UUID, p_amount DECIMAL(18,2))
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE shops SET locked_balance = locked_balance + p_amount, updated_at = NOW() WHERE id = p_shop_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
