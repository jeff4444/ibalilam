-- Add locked_balance and available_balance columns to shops table for escrow management
-- locked_balance: Funds held until order is delivered
-- available_balance: Funds released after successful delivery

ALTER TABLE shops
ADD COLUMN IF NOT EXISTS locked_balance DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS available_balance DECIMAL(10,2) DEFAULT 0.00;

-- Add constraints to ensure balances cannot go negative
ALTER TABLE shops
ADD CONSTRAINT chk_locked_balance_non_negative CHECK (locked_balance >= 0),
ADD CONSTRAINT chk_available_balance_non_negative CHECK (available_balance >= 0);

-- Create a function to release funds from locked to available balance
CREATE OR REPLACE FUNCTION release_escrow_funds(
  p_shop_id UUID,
  p_amount DECIMAL(10,2)
)
RETURNS BOOLEAN AS $$
DECLARE
  v_locked_balance DECIMAL(10,2);
BEGIN
  -- Get current locked balance
  SELECT locked_balance INTO v_locked_balance
  FROM shops
  WHERE id = p_shop_id
  FOR UPDATE;
  
  -- Check if we have enough locked funds
  IF v_locked_balance < p_amount THEN
    -- If locked balance is insufficient, release whatever is available
    -- This handles edge cases where amounts might be slightly off
    p_amount := v_locked_balance;
  END IF;
  
  -- Transfer from locked to available
  UPDATE shops
  SET 
    locked_balance = locked_balance - p_amount,
    available_balance = available_balance + p_amount,
    updated_at = NOW()
  WHERE id = p_shop_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to add funds to locked balance
CREATE OR REPLACE FUNCTION add_to_locked_balance(
  p_shop_id UUID,
  p_amount DECIMAL(10,2)
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE shops
  SET 
    locked_balance = locked_balance + p_amount,
    updated_at = NOW()
  WHERE id = p_shop_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION release_escrow_funds(UUID, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION add_to_locked_balance(UUID, DECIMAL) TO authenticated;

-- Comment on columns
COMMENT ON COLUMN shops.locked_balance IS 'Funds held in escrow until order delivery';
COMMENT ON COLUMN shops.available_balance IS 'Funds available for withdrawal after order delivery';

