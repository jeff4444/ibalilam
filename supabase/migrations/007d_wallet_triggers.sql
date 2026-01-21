-- ============================================================
-- 007d_wallet_triggers.sql
-- Wallet triggers and shop balance functions
-- ============================================================

-- Balance drift warning function
CREATE OR REPLACE FUNCTION log_balance_drift_warning()
RETURNS TRIGGER AS $$
DECLARE
  v_shop_id UUID;
  v_shop_locked DECIMAL(18,2);
  v_shop_available DECIMAL(18,2);
BEGIN
  SELECT id INTO v_shop_id FROM shops WHERE user_id = NEW.user_id;
  IF v_shop_id IS NOT NULL THEN
    SELECT locked_balance, available_balance INTO v_shop_locked, v_shop_available
    FROM shops WHERE id = v_shop_id;
    IF ABS(NEW.locked_balance - COALESCE(v_shop_locked, 0)) > 0.01 OR
       ABS(NEW.available_balance - COALESCE(v_shop_available, 0)) > 0.01 THEN
      RAISE WARNING 'BALANCE_DRIFT_DETECTED: user_id=%, wallet_locked=%, shop_locked=%, wallet_available=%, shop_available=%',
        NEW.user_id, NEW.locked_balance, v_shop_locked, NEW.available_balance, v_shop_available;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_balance_drift
  AFTER UPDATE ON user_wallets
  FOR EACH ROW
  WHEN (OLD.locked_balance IS DISTINCT FROM NEW.locked_balance 
     OR OLD.available_balance IS DISTINCT FROM NEW.available_balance)
  EXECUTE FUNCTION log_balance_drift_warning();

-- Shop balance release function
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

-- Shop balance add function
CREATE OR REPLACE FUNCTION add_to_locked_balance(p_shop_id UUID, p_amount DECIMAL(18,2))
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE shops SET locked_balance = locked_balance + p_amount, updated_at = NOW()
  WHERE id = p_shop_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Table comments
COMMENT ON TABLE user_wallets IS 'User wallet balances - available and locked (escrow) funds';

COMMENT ON TABLE wallet_transactions IS 'All wallet transaction history';

COMMENT ON COLUMN user_wallets.available_balance IS 'Funds available for withdrawal - DECIMAL(18,2)';

COMMENT ON COLUMN user_wallets.locked_balance IS 'Funds held in escrow pending delivery confirmation';

COMMENT ON FUNCTION get_or_create_wallet IS 'Gets existing wallet or creates new one for user';

COMMENT ON FUNCTION record_wallet_deposit IS 'Records a deposit from PayFast into user wallet';

COMMENT ON FUNCTION atomic_escrow_hold IS 'Atomically adds funds to escrow with FOR UPDATE locking';

COMMENT ON FUNCTION atomic_escrow_release IS 'Atomically releases funds from escrow with FOR UPDATE locking';
