-- ============================================================
-- 007_wallet_system.sql
-- User wallet system with secure implementation
-- ============================================================

-- ============================================================
-- USER_WALLETS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS user_wallets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  available_balance DECIMAL(18,2) DEFAULT 0.00 NOT NULL,
  locked_balance DECIMAL(18,2) DEFAULT 0.00 NOT NULL,
  total_deposited DECIMAL(18,2) DEFAULT 0.00 NOT NULL,
  total_withdrawn DECIMAL(18,2) DEFAULT 0.00 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT chk_wallet_available_balance_non_negative CHECK (available_balance >= 0),
  CONSTRAINT chk_wallet_locked_balance_non_negative CHECK (locked_balance >= 0),
  CONSTRAINT chk_wallet_total_deposited_non_negative CHECK (total_deposited >= 0),
  CONSTRAINT chk_wallet_total_withdrawn_non_negative CHECK (total_withdrawn >= 0),
  CONSTRAINT chk_wallet_available_balance_max CHECK (available_balance < 1000000000000.00),
  CONSTRAINT chk_wallet_locked_balance_max CHECK (locked_balance < 1000000000000.00),
  CONSTRAINT chk_wallet_total_deposited_max CHECK (total_deposited < 1000000000000.00),
  CONSTRAINT chk_wallet_total_withdrawn_max CHECK (total_withdrawn < 1000000000000.00)
);

CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON user_wallets(user_id);

CREATE INDEX IF NOT EXISTS idx_user_wallets_available_balance ON user_wallets(available_balance);

ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_user_wallets_updated_at
  BEFORE UPDATE ON user_wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- WALLET_TRANSACTIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID REFERENCES user_wallets(id) ON DELETE CASCADE NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'deposit', 'withdrawal', 'escrow_hold', 'escrow_release',
    'sale_credit', 'commission_deduction', 'refund', 'adjustment'
  )),
  amount DECIMAL(18,2) NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  reference_id UUID,
  reference_type TEXT CHECK (reference_type IN ('order', 'payfast', 'manual', 'payout')),
  description TEXT,
  balance_after DECIMAL(18,2),
  payfast_payment_id TEXT,
  payfast_payout_batch_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT chk_wallet_transaction_amount_non_zero CHECK (amount != 0),
  CONSTRAINT chk_wallet_tx_amount_max CHECK (ABS(amount) < 1000000000000.00),
  CONSTRAINT chk_wallet_tx_balance_after_max CHECK (balance_after IS NULL OR balance_after < 1000000000000.00)
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(transaction_type);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_status ON wallet_transactions(status);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference ON wallet_transactions(reference_id, reference_type);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_payfast ON wallet_transactions(payfast_payment_id);

ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_wallet_transactions_updated_at
  BEFORE UPDATE ON wallet_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
