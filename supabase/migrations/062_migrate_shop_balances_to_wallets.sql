-- Migration to transfer existing shop balances to user wallets
-- This creates wallets for all shop owners and transfers their balances

-- First, create wallets for all users who don't have one yet (especially shop owners)
INSERT INTO user_wallets (user_id)
SELECT DISTINCT s.user_id
FROM shops s
WHERE s.user_id NOT IN (SELECT user_id FROM user_wallets WHERE user_id IS NOT NULL)
ON CONFLICT (user_id) DO NOTHING;

-- Transfer existing shop balances to user wallets
-- This updates the user_wallets with the sum of their shop balances
DO $$
DECLARE
  shop_record RECORD;
  wallet_id_var UUID;
  current_available DECIMAL(10,2);
  current_locked DECIMAL(10,2);
BEGIN
  -- Loop through all shops with non-zero balances
  FOR shop_record IN 
    SELECT 
      s.id as shop_id,
      s.user_id,
      s.name as shop_name,
      COALESCE(s.available_balance, 0) as available_balance,
      COALESCE(s.locked_balance, 0) as locked_balance
    FROM shops s
    WHERE COALESCE(s.available_balance, 0) > 0 OR COALESCE(s.locked_balance, 0) > 0
  LOOP
    -- Get or create wallet for this user
    SELECT id INTO wallet_id_var
    FROM user_wallets
    WHERE user_id = shop_record.user_id;
    
    IF wallet_id_var IS NULL THEN
      INSERT INTO user_wallets (user_id)
      VALUES (shop_record.user_id)
      RETURNING id INTO wallet_id_var;
    END IF;
    
    -- Get current wallet balances
    SELECT available_balance, locked_balance 
    INTO current_available, current_locked
    FROM user_wallets
    WHERE id = wallet_id_var;
    
    -- Update wallet with shop balances (add to existing)
    UPDATE user_wallets
    SET 
      available_balance = COALESCE(current_available, 0) + shop_record.available_balance,
      locked_balance = COALESCE(current_locked, 0) + shop_record.locked_balance,
      updated_at = NOW()
    WHERE id = wallet_id_var;
    
    -- Create wallet transaction records for the migration
    IF shop_record.available_balance > 0 THEN
      INSERT INTO wallet_transactions (
        wallet_id,
        transaction_type,
        amount,
        status,
        reference_type,
        description,
        balance_after
      ) VALUES (
        wallet_id_var,
        'adjustment',
        shop_record.available_balance,
        'completed',
        'manual',
        'Migration from shop balance (' || shop_record.shop_name || ')',
        COALESCE(current_available, 0) + shop_record.available_balance
      );
    END IF;
    
    IF shop_record.locked_balance > 0 THEN
      INSERT INTO wallet_transactions (
        wallet_id,
        transaction_type,
        amount,
        status,
        reference_type,
        description,
        balance_after
      ) VALUES (
        wallet_id_var,
        'escrow_hold',
        shop_record.locked_balance,
        'completed',
        'manual',
        'Migration from shop escrow balance (' || shop_record.shop_name || ')',
        COALESCE(current_locked, 0) + shop_record.locked_balance
      );
    END IF;
    
    RAISE NOTICE 'Migrated balances for shop % (user %): available=%, locked=%', 
      shop_record.shop_name, shop_record.user_id, shop_record.available_balance, shop_record.locked_balance;
  END LOOP;
END $$;

-- Add a comment to track that migration happened
COMMENT ON TABLE user_wallets IS 'User wallet balances - available and locked (escrow) funds. Balances migrated from shops table.';

-- Note: We keep shop balances intact for backward compatibility
-- The application code now updates both shop balances AND user wallets
-- This ensures existing functionality continues to work while new wallet features are available

