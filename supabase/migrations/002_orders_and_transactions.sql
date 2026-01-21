-- ============================================================
-- 002_orders_and_transactions.sql
-- Orders, order items, transactions, escrow holds
-- ============================================================

-- ============================================================
-- ORDER NUMBER SEQUENCE (Atomic generation)
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS order_number_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  NO CYCLE;

-- Function to generate order numbers atomically
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'ORD-' || LPAD(nextval('order_number_seq')::TEXT, 8, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ORDERS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Customer information (for guest orders)
  customer_email TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  
  -- Order details
  status TEXT CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')) DEFAULT 'pending',
  total_amount DECIMAL(18,2) NOT NULL,
  subtotal DECIMAL(18,2) NOT NULL,
  tax_amount DECIMAL(18,2) DEFAULT 0.00,
  shipping_amount DECIMAL(18,2) DEFAULT 0.00,
  discount_amount DECIMAL(18,2) DEFAULT 0.00,
  
  -- Shipping information
  shipping_address JSONB,
  billing_address JSONB,
  
  -- Tracking information
  tracking_number TEXT,
  carrier TEXT,
  tracking_url TEXT,
  
  -- Payment information
  payment_method TEXT,
  payment_status TEXT CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')) DEFAULT 'pending',
  payment_intent_id TEXT,
  
  -- Order notes
  customer_notes TEXT,
  internal_notes TEXT,
  
  -- Soft delete (VULN-021 fix)
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID REFERENCES auth.users(id),
  deletion_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT chk_total_amount_positive CHECK (total_amount > 0),
  CONSTRAINT chk_subtotal_positive CHECK (subtotal > 0),
  CONSTRAINT chk_order_total_amount_max CHECK (total_amount < 100000000000.00),
  CONSTRAINT chk_order_subtotal_max CHECK (subtotal < 100000000000.00),
  CONSTRAINT orders_payment_intent_id_unique UNIQUE (payment_intent_id)
);

-- Indexes for orders
CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON orders(tracking_number);
CREATE INDEX IF NOT EXISTS idx_orders_deleted_at ON orders(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_payment_intent_id ON orders(payment_intent_id) WHERE payment_intent_id IS NOT NULL;

-- Enable RLS for orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to set order number on insert
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically generate order numbers
CREATE TRIGGER set_orders_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();

-- Comments
COMMENT ON COLUMN orders.tracking_number IS 'Shipping tracking number provided by carrier';
COMMENT ON COLUMN orders.carrier IS 'Shipping carrier name (e.g., FedEx, UPS, DHL, Postal Service)';
COMMENT ON COLUMN orders.tracking_url IS 'URL to track the package on carrier website';
COMMENT ON COLUMN orders.deleted_at IS 'Soft delete timestamp - NULL means active record';
COMMENT ON COLUMN orders.deleted_by IS 'User who performed the soft delete';
COMMENT ON COLUMN orders.deletion_reason IS 'Reason for deletion (audit trail)';

-- ============================================================
-- ORDER_ITEMS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  part_id UUID REFERENCES parts(id) ON DELETE CASCADE NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(18,2) NOT NULL,
  total_price DECIMAL(18,2) NOT NULL,
  tax_amount DECIMAL(18,2) DEFAULT 0.00,
  shipping_amount DECIMAL(18,2) DEFAULT 0.00,
  discount_amount DECIMAL(18,2) DEFAULT 0.00,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT chk_quantity_positive CHECK (quantity > 0),
  CONSTRAINT chk_unit_price_positive CHECK (unit_price > 0),
  CONSTRAINT chk_total_price_positive CHECK (total_price > 0),
  CONSTRAINT chk_order_item_unit_price_max CHECK (unit_price < 10000000000.00),
  CONSTRAINT chk_order_item_total_price_max CHECK (total_price < 100000000000.00)
);

-- Indexes for order_items
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_part_id ON order_items(part_id);

-- Enable RLS for order_items
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TRANSACTIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE RESTRICT NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  commission_amount DECIMAL(18,2) DEFAULT 0.00,
  seller_amount DECIMAL(18,2) DEFAULT 0.00,
  status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'disputed')) DEFAULT 'pending',
  payment_method TEXT,
  payment_intent_id TEXT,
  escrow_status TEXT CHECK (escrow_status IN ('held', 'released', 'refunded', 'disputed')) DEFAULT 'held',
  escrow_hold_until TIMESTAMP WITH TIME ZONE,
  
  -- Soft delete
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID REFERENCES auth.users(id),
  deletion_reason TEXT,
  
  -- Timestamps and notes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  refunded_at TIMESTAMP WITH TIME ZONE,
  refund_reason TEXT,
  dispute_reason TEXT,
  admin_notes TEXT,
  
  -- Constraints
  CONSTRAINT chk_amount_positive CHECK (amount > 0),
  CONSTRAINT chk_commission_amount_non_negative CHECK (commission_amount >= 0),
  CONSTRAINT chk_seller_amount_non_negative CHECK (seller_amount >= 0),
  CONSTRAINT chk_tx_amount_max CHECK (amount < 100000000000.00),
  CONSTRAINT chk_tx_commission_max CHECK (commission_amount < 10000000000.00),
  CONSTRAINT chk_tx_seller_amount_max CHECK (seller_amount < 100000000000.00),
  CONSTRAINT transactions_payment_intent_id_unique UNIQUE (payment_intent_id)
);

-- Indexes for transactions
CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_escrow_status ON transactions(escrow_status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_deleted_at ON transactions(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_payment_intent_id ON transactions(payment_intent_id) WHERE payment_intent_id IS NOT NULL;

-- Enable RLS for transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at
CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON COLUMN transactions.deleted_at IS 'Soft delete timestamp - NULL means active record';
COMMENT ON COLUMN transactions.deleted_by IS 'User who performed the soft delete';
COMMENT ON COLUMN transactions.deletion_reason IS 'Reason for deletion (audit trail)';
COMMENT ON CONSTRAINT transactions_payment_intent_id_unique ON transactions IS 'Ensures idempotency - prevents duplicate transactions from payment gateway retries';

-- ============================================================
-- ESCROW_HOLDS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS escrow_holds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  hold_until TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT CHECK (status IN ('active', 'released', 'refunded')) DEFAULT 'active',
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  released_at TIMESTAMP WITH TIME ZONE,
  refunded_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT chk_escrow_amount_positive CHECK (amount > 0),
  CONSTRAINT chk_escrow_amount_max CHECK (amount < 100000000000.00)
);

-- Indexes for escrow_holds
CREATE INDEX IF NOT EXISTS idx_escrow_holds_transaction_id ON escrow_holds(transaction_id);
CREATE INDEX IF NOT EXISTS idx_escrow_holds_status ON escrow_holds(status);
CREATE INDEX IF NOT EXISTS idx_escrow_holds_hold_until ON escrow_holds(hold_until);

-- Enable RLS for escrow_holds
ALTER TABLE escrow_holds ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ORDER TOTALS CALCULATION
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_order_totals()
RETURNS TRIGGER AS $$
DECLARE
  order_subtotal DECIMAL(18,2);
  order_total DECIMAL(18,2);
  order_record RECORD;
BEGIN
  -- Get the order_id from either NEW or OLD
  IF TG_OP = 'DELETE' THEN
    SELECT * INTO order_record FROM orders WHERE id = OLD.order_id;
  ELSE
    SELECT * INTO order_record FROM orders WHERE id = NEW.order_id;
  END IF;
  
  -- Calculate subtotal from order items
  SELECT COALESCE(SUM(total_price), 0) INTO order_subtotal
  FROM order_items
  WHERE order_id = order_record.id;
  
  -- Calculate total (subtotal + tax + shipping - discount)
  order_total := order_subtotal + COALESCE(order_record.tax_amount, 0) + COALESCE(order_record.shipping_amount, 0) - COALESCE(order_record.discount_amount, 0);
  
  -- Update the order
  UPDATE orders
  SET subtotal = order_subtotal, total_amount = GREATEST(order_total, 0.01)
  WHERE id = order_record.id;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger to recalculate order totals when order items change
CREATE TRIGGER calculate_order_totals_trigger
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_order_totals();

-- ============================================================
-- SOFT DELETE FUNCTIONS
-- ============================================================

-- Function to soft delete an order
CREATE OR REPLACE FUNCTION soft_delete_order(
  p_order_id UUID, 
  p_deleted_by UUID,
  p_reason TEXT DEFAULT 'Manual deletion'
)
RETURNS JSONB AS $$
DECLARE
  v_order_exists BOOLEAN;
  v_already_deleted BOOLEAN;
  v_transaction_count INTEGER;
BEGIN
  -- Check if order exists
  SELECT EXISTS(SELECT 1 FROM orders WHERE id = p_order_id) INTO v_order_exists;
  IF NOT v_order_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  -- Check if already deleted
  SELECT deleted_at IS NOT NULL INTO v_already_deleted 
  FROM orders WHERE id = p_order_id;
  IF v_already_deleted THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order already deleted');
  END IF;
  
  -- Soft delete the order
  UPDATE orders 
  SET 
    deleted_at = NOW(), 
    deleted_by = p_deleted_by,
    deletion_reason = p_reason
  WHERE id = p_order_id AND deleted_at IS NULL;
  
  -- Soft delete associated transactions
  UPDATE transactions 
  SET 
    deleted_at = NOW(), 
    deleted_by = p_deleted_by,
    deletion_reason = p_reason || ' (cascaded from order)'
  WHERE order_id = p_order_id AND deleted_at IS NULL;
  
  GET DIAGNOSTICS v_transaction_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true, 
    'order_id', p_order_id,
    'transactions_deleted', v_transaction_count,
    'deleted_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to restore a soft-deleted order
CREATE OR REPLACE FUNCTION restore_deleted_order(
  p_order_id UUID,
  p_restored_by UUID
)
RETURNS JSONB AS $$
DECLARE
  v_order_exists BOOLEAN;
  v_is_deleted BOOLEAN;
  v_transaction_count INTEGER;
BEGIN
  -- Check if order exists
  SELECT EXISTS(SELECT 1 FROM orders WHERE id = p_order_id) INTO v_order_exists;
  IF NOT v_order_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  -- Check if actually deleted
  SELECT deleted_at IS NOT NULL INTO v_is_deleted 
  FROM orders WHERE id = p_order_id;
  IF NOT v_is_deleted THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order is not deleted');
  END IF;
  
  -- Restore the order
  UPDATE orders 
  SET 
    deleted_at = NULL, 
    deleted_by = NULL,
    deletion_reason = NULL
  WHERE id = p_order_id;
  
  -- Restore associated transactions
  UPDATE transactions 
  SET 
    deleted_at = NULL, 
    deleted_by = NULL,
    deletion_reason = NULL
  WHERE order_id = p_order_id AND deleted_at IS NOT NULL;
  
  GET DIAGNOSTICS v_transaction_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true, 
    'order_id', p_order_id,
    'transactions_restored', v_transaction_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to prevent hard deletes on financial records
CREATE OR REPLACE FUNCTION prevent_hard_delete_financial_records()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow deletion only if the record is already soft-deleted
  IF OLD.deleted_at IS NULL THEN
    RAISE EXCEPTION 'Hard deletion of financial records is not allowed. Use soft_delete_order() function instead.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Triggers to prevent hard deletes
CREATE TRIGGER prevent_orders_hard_delete
  BEFORE DELETE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION prevent_hard_delete_financial_records();

CREATE TRIGGER prevent_transactions_hard_delete
  BEFORE DELETE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_hard_delete_financial_records();

-- ============================================================
-- VIEWS FOR ACTIVE RECORDS
-- ============================================================

CREATE OR REPLACE VIEW active_orders AS
SELECT * FROM orders WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW active_transactions AS
SELECT * FROM transactions WHERE deleted_at IS NULL;

-- Comments
COMMENT ON FUNCTION soft_delete_order IS 'Safely soft-deletes an order and its transactions';
COMMENT ON FUNCTION restore_deleted_order IS 'Restores a soft-deleted order and its transactions';
COMMENT ON VIEW active_orders IS 'View showing only non-deleted orders';
COMMENT ON VIEW active_transactions IS 'View showing only non-deleted transactions';
