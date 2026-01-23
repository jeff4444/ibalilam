-- 029: atomic_decrement_stock function
-- Atomic stock decrement with row-level locking to prevent race conditions (HIGH-001)
CREATE OR REPLACE FUNCTION atomic_decrement_stock(
  p_part_id UUID,
  p_quantity INTEGER
) RETURNS TABLE (
  success BOOLEAN,
  previous_stock INTEGER,
  new_stock INTEGER,
  error_message TEXT
) AS $$
DECLARE
  v_current_stock INTEGER;
  v_new_stock INTEGER;
BEGIN
  IF p_part_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::INTEGER, NULL::INTEGER, 'part_id is required'::TEXT;
    RETURN;
  END IF;
  IF p_quantity <= 0 THEN
    RETURN QUERY SELECT FALSE, NULL::INTEGER, NULL::INTEGER, 'quantity must be positive'::TEXT;
    RETURN;
  END IF;
  SELECT stock_quantity INTO v_current_stock FROM parts WHERE id = p_part_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::INTEGER, NULL::INTEGER, 'Part not found'::TEXT;
    RETURN;
  END IF;
  IF v_current_stock < p_quantity THEN
    RETURN QUERY SELECT FALSE, v_current_stock, v_current_stock,
      ('Insufficient stock: requested ' || p_quantity || ', available ' || v_current_stock)::TEXT;
    RETURN;
  END IF;
  v_new_stock := v_current_stock - p_quantity;
  UPDATE parts SET stock_quantity = v_new_stock WHERE id = p_part_id;
  RETURN QUERY SELECT TRUE, v_current_stock, v_new_stock, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
