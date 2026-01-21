-- ============================================================
-- 011_functions_and_grants.sql
-- Remaining functions and permissions
-- ============================================================

-- ============================================================
-- SEARCH FUNCTIONS
-- ============================================================

-- Function to search parts
CREATE OR REPLACE FUNCTION search_parts(
  search_query TEXT DEFAULT '',
  category_filter TEXT DEFAULT '',
  min_price DECIMAL DEFAULT 0,
  max_price DECIMAL DEFAULT 999999,
  part_type_filter TEXT DEFAULT '',
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  category TEXT,
  price DECIMAL(18,2),
  stock_quantity INTEGER,
  part_type TEXT,
  image_url TEXT,
  shop_name TEXT,
  shop_rating DECIMAL(3,2),
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.description,
    p.category,
    p.price,
    p.stock_quantity,
    p.part_type,
    p.image_url,
    s.name as shop_name,
    s.rating as shop_rating,
    p.created_at
  FROM parts p
  JOIN shops s ON p.shop_id = s.id
  WHERE p.status = 'active'
    AND p.published_at IS NOT NULL
    AND (search_query = '' OR p.name ILIKE '%' || search_query || '%' OR p.description ILIKE '%' || search_query || '%')
    AND (category_filter = '' OR p.category = category_filter)
    AND p.price >= min_price
    AND p.price <= max_price
    AND (part_type_filter = '' OR p.part_type = part_type_filter)
  ORDER BY p.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- MOQ VALIDATION FUNCTIONS
-- ============================================================

-- Function to validate MOQ rules
CREATE OR REPLACE FUNCTION validate_moq_quantity(
  part_id_param UUID,
  quantity INTEGER
)
RETURNS TABLE (
  is_valid BOOLEAN,
  error_message TEXT,
  suggested_quantity INTEGER
) AS $$
DECLARE
  part_record RECORD;
  v_moq_units INTEGER;
  v_order_increment INTEGER;
  v_pack_size_units INTEGER;
  suggested_qty INTEGER;
  error_msg TEXT;
BEGIN
  SELECT moq_units, order_increment, pack_size_units
  INTO part_record
  FROM parts WHERE id = part_id_param;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Part not found'::TEXT, quantity;
    RETURN;
  END IF;
  
  v_moq_units := COALESCE(part_record.moq_units, 1);
  v_order_increment := COALESCE(part_record.order_increment, 1);
  v_pack_size_units := part_record.pack_size_units;
  suggested_qty := quantity;
  error_msg := '';
  
  IF quantity < v_moq_units THEN
    error_msg := error_msg || 'Quantity must be at least ' || v_moq_units || ' units. ';
    suggested_qty := v_moq_units;
  END IF;
  
  IF v_pack_size_units IS NOT NULL THEN
    IF quantity % v_pack_size_units != 0 THEN
      error_msg := error_msg || 'Quantity must be in packs of ' || v_pack_size_units || '. ';
      suggested_qty := CEIL(quantity::DECIMAL / v_pack_size_units) * v_pack_size_units;
    END IF;
  ELSE
    IF quantity % v_order_increment != 0 THEN
      error_msg := error_msg || 'Quantity must be in increments of ' || v_order_increment || '. ';
      suggested_qty := CEIL(quantity::DECIMAL / v_order_increment) * v_order_increment;
    END IF;
  END IF;
  
  IF suggested_qty < v_moq_units THEN
    suggested_qty := v_moq_units;
  END IF;
  
  RETURN QUERY SELECT 
    CASE WHEN error_msg = '' THEN true ELSE false END,
    error_msg,
    suggested_qty;
END;
$$ LANGUAGE plpgsql;

-- Function to get tier pricing for a part and quantity
CREATE OR REPLACE FUNCTION get_tier_price(
  part_id_param UUID,
  quantity INTEGER
)
RETURNS TABLE (
  unit_price DECIMAL(18,2),
  total_price DECIMAL(18,2),
  tier_name TEXT
) AS $$
DECLARE
  best_tier RECORD;
  base_price DECIMAL(18,2);
BEGIN
  SELECT pt.unit_price, pt.min_qty INTO best_tier
  FROM price_tiers pt
  WHERE pt.part_id = part_id_param AND pt.min_qty <= quantity
  ORDER BY pt.min_qty DESC LIMIT 1;
  
  IF best_tier IS NULL THEN
    SELECT price INTO base_price FROM parts WHERE id = part_id_param;
    RETURN QUERY SELECT base_price, base_price * quantity, 'Base Price'::TEXT;
  ELSE
    RETURN QUERY SELECT best_tier.unit_price, best_tier.unit_price * quantity, 'Tier: ' || best_tier.min_qty || '+'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get available quantity
CREATE OR REPLACE FUNCTION get_available_quantity(part_id_param UUID)
RETURNS TABLE (
  in_stock INTEGER,
  backorder_available BOOLEAN,
  lead_time_days INTEGER
) AS $$
DECLARE
  part_record RECORD;
BEGIN
  SELECT stock_on_hand_units, backorder_allowed, p.lead_time_days
  INTO part_record FROM parts p WHERE p.id = part_id_param;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, false, NULL::INTEGER;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT 
    COALESCE(part_record.stock_on_hand_units, 0),
    COALESCE(part_record.backorder_allowed, false),
    part_record.lead_time_days;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- USER/SHOP TRIGGER FUNCTIONS
-- ============================================================

-- Function to automatically create a shop for new users (optional - can be disabled)
CREATE OR REPLACE FUNCTION create_shop_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO shops (user_id, name, description, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'shop_name', 'My Shop'),
    COALESCE(NEW.raw_user_meta_data->>'shop_description', 'Welcome to my electronics shop!'),
    true
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't fail user creation if shop creation fails
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to sync user metadata with shop data
CREATE OR REPLACE FUNCTION sync_user_metadata_with_shop()
RETURNS TRIGGER AS $$
DECLARE
  shop_record RECORD;
BEGIN
  SELECT * INTO shop_record FROM shops WHERE user_id = NEW.id;
  
  IF shop_record.id IS NOT NULL THEN
    UPDATE shops
    SET 
      name = COALESCE(NEW.raw_user_meta_data->>'shop_name', shop_record.name),
      description = COALESCE(NEW.raw_user_meta_data->>'shop_description', shop_record.description),
      updated_at = NOW()
    WHERE id = shop_record.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers on auth.users (these may need to be created via Supabase dashboard)
-- CREATE TRIGGER create_shop_on_user_signup
--   AFTER INSERT ON auth.users
--   FOR EACH ROW
--   EXECUTE FUNCTION create_shop_for_new_user();

-- CREATE TRIGGER sync_user_metadata_with_shop_trigger
--   AFTER UPDATE OF raw_user_meta_data ON auth.users
--   FOR EACH ROW
--   EXECUTE FUNCTION sync_user_metadata_with_shop();

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant access to views
GRANT SELECT ON active_orders TO authenticated;
GRANT SELECT ON active_transactions TO authenticated;
GRANT SELECT ON audit_logs_summary TO authenticated;

-- Grant sequence permissions for order numbers
GRANT USAGE, SELECT ON SEQUENCE order_number_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE order_number_seq TO service_role;

-- ============================================================
-- SECURITY NOTE
-- ============================================================
-- Wallet functions (record_wallet_deposit, record_wallet_withdrawal, etc.) are 
-- SECURITY DEFINER functions. Access control is enforced at the API route level.
-- These functions should only be called from server-side code with service_role.
-- The RLS policies on user_wallets table prevent direct user manipulation.
