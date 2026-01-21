-- 024: check_balance_drift trigger
DROP TRIGGER IF EXISTS check_balance_drift ON user_wallets;
CREATE TRIGGER check_balance_drift
  AFTER UPDATE ON user_wallets
  FOR EACH ROW
  WHEN (OLD.locked_balance IS DISTINCT FROM NEW.locked_balance 
     OR OLD.available_balance IS DISTINCT FROM NEW.available_balance)
  EXECUTE FUNCTION log_balance_drift_warning();
