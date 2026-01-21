-- 023: log_balance_drift_warning trigger function
CREATE OR REPLACE FUNCTION log_balance_drift_warning()
RETURNS TRIGGER AS $$
DECLARE
  v_shop_id UUID;
  v_shop_locked DECIMAL(18,2);
  v_shop_available DECIMAL(18,2);
BEGIN
  SELECT id INTO v_shop_id FROM shops WHERE user_id = NEW.user_id;
  IF v_shop_id IS NOT NULL THEN
    SELECT locked_balance, available_balance INTO v_shop_locked, v_shop_available FROM shops WHERE id = v_shop_id;
    IF ABS(NEW.locked_balance - COALESCE(v_shop_locked, 0)) > 0.01 OR
       ABS(NEW.available_balance - COALESCE(v_shop_available, 0)) > 0.01 THEN
      RAISE WARNING 'BALANCE_DRIFT_DETECTED: user_id=%, wallet_locked=%, shop_locked=%, wallet_available=%, shop_available=%',
        NEW.user_id, NEW.locked_balance, v_shop_locked, NEW.available_balance, v_shop_available;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
