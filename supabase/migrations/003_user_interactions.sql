-- ============================================================
-- 003_user_interactions.sql
-- User favorites, chats, cart, shipping addresses
-- ============================================================

-- ============================================================
-- USER_FAVORITES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS user_favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  part_id UUID REFERENCES parts(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure a user can only favorite a part once
  UNIQUE(user_id, part_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_part_id ON user_favorites(part_id);

-- Enable RLS
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PART_SAVES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS part_saves (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  part_id UUID REFERENCES parts(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure a user can only save a part once
  UNIQUE(user_id, part_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_part_saves_user_id ON part_saves(user_id);
CREATE INDEX IF NOT EXISTS idx_part_saves_part_id ON part_saves(part_id);

-- Enable RLS
ALTER TABLE part_saves ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PART_CHATS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS part_chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  part_id UUID REFERENCES parts(id) ON DELETE CASCADE NOT NULL,
  buyer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  
  -- Phone reveal functionality
  phone_revealed_by_buyer BOOLEAN DEFAULT false,
  phone_revealed_by_seller BOOLEAN DEFAULT false,
  phone_revealed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  safety_tips_shown BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one chat per buyer-seller-part combination
  UNIQUE(part_id, buyer_id, seller_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_part_chats_part_id ON part_chats(part_id);
CREATE INDEX IF NOT EXISTS idx_part_chats_buyer_id ON part_chats(buyer_id);
CREATE INDEX IF NOT EXISTS idx_part_chats_seller_id ON part_chats(seller_id);

-- Enable RLS
ALTER TABLE part_chats ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PART_CHAT_MESSAGES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS part_chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID REFERENCES part_chats(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message_text TEXT NOT NULL,
  message_type TEXT CHECK (message_type IN ('text', 'image', 'file')) DEFAULT 'text',
  file_url TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_part_chat_messages_chat_id ON part_chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_part_chat_messages_sender_id ON part_chat_messages(sender_id);

-- Enable RLS
ALTER TABLE part_chat_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PART_VIEW_LOGS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS part_view_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  part_id UUID REFERENCES parts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  referrer TEXT,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_part_view_logs_part_id ON part_view_logs(part_id);
CREATE INDEX IF NOT EXISTS idx_part_view_logs_user_id ON part_view_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_part_view_logs_viewed_at ON part_view_logs(viewed_at);

-- Enable RLS
ALTER TABLE part_view_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- MESSAGE_READ_STATUS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS message_read_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES part_chat_messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one read status per user per message
  UNIQUE(message_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_message_read_status_message_id ON message_read_status(message_id);
CREATE INDEX IF NOT EXISTS idx_message_read_status_user_id ON message_read_status(user_id);

-- Enable RLS
ALTER TABLE message_read_status ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- CHAT_NOTIFICATIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS chat_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID REFERENCES part_chats(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  notification_type TEXT CHECK (notification_type IN ('new_message', 'phone_revealed', 'chat_started')) NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_notifications_chat_id ON chat_notifications(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_notifications_user_id ON chat_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_notifications_is_read ON chat_notifications(is_read);

-- Enable RLS
ALTER TABLE chat_notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SAFETY_TIPS_SHOWN TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS safety_tips_shown (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  shown_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one record per user
  UNIQUE(user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_safety_tips_shown_user_id ON safety_tips_shown(user_id);

-- Enable RLS
ALTER TABLE safety_tips_shown ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- CART_ITEMS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS cart_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  part_id UUID REFERENCES parts(id) ON DELETE CASCADE NOT NULL,
  quantity INTEGER NOT NULL,
  tier_price DECIMAL(18,2),
  tier_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT chk_cart_quantity_positive CHECK (quantity > 0),
  UNIQUE(user_id, part_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_part_id ON cart_items(part_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_user_part ON cart_items(user_id, part_id);

-- Enable RLS
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at
CREATE TRIGGER update_cart_items_updated_at
  BEFORE UPDATE ON cart_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SHIPPING_ADDRESSES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS shipping_addresses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  label TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  country TEXT DEFAULT 'ZA' NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shipping_addresses_user_id ON shipping_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_shipping_addresses_user_id_default ON shipping_addresses(user_id, is_default) WHERE is_default = true;

-- Enable RLS
ALTER TABLE shipping_addresses ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at
CREATE TRIGGER update_shipping_addresses_updated_at
  BEFORE UPDATE ON shipping_addresses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to ensure only one default address per user
CREATE OR REPLACE FUNCTION ensure_single_default_address()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE shipping_addresses
    SET is_default = false
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to ensure only one default address per user
CREATE TRIGGER ensure_single_default_address_trigger
  BEFORE INSERT OR UPDATE ON shipping_addresses
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION ensure_single_default_address();

-- ============================================================
-- CHAT AND MESSAGING FUNCTIONS
-- ============================================================

-- Function to update last_message_at when new message is added
CREATE OR REPLACE FUNCTION update_chat_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE part_chats 
  SET last_message_at = NEW.created_at
  WHERE id = NEW.chat_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update last_message_at
CREATE TRIGGER trigger_update_chat_last_message
  AFTER INSERT ON part_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_last_message();

-- Function to create notification when new message is added
CREATE OR REPLACE FUNCTION create_message_notification()
RETURNS TRIGGER AS $$
DECLARE
  chat_record RECORD;
  other_user_id UUID;
BEGIN
  -- Get chat details
  SELECT buyer_id, seller_id INTO chat_record
  FROM part_chats 
  WHERE id = NEW.chat_id;
  
  -- Determine the other user (not the sender)
  IF NEW.sender_id = chat_record.buyer_id THEN
    other_user_id := chat_record.seller_id;
  ELSE
    other_user_id := chat_record.buyer_id;
  END IF;
  
  -- Create notification for the other user
  INSERT INTO chat_notifications (chat_id, user_id, notification_type)
  VALUES (NEW.chat_id, other_user_id, 'new_message');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create notifications
CREATE TRIGGER trigger_create_message_notification
  AFTER INSERT ON part_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION create_message_notification();

-- Function to update part views count
CREATE OR REPLACE FUNCTION update_part_views_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE parts 
  SET views = (
    SELECT COUNT(*) 
    FROM part_view_logs 
    WHERE part_id = NEW.part_id
  )
  WHERE id = NEW.part_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update part views count
CREATE TRIGGER trigger_update_part_views_count
  AFTER INSERT ON part_view_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_part_views_count();

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to get user's favorite part IDs
CREATE OR REPLACE FUNCTION get_user_favorite_part_ids(user_uuid UUID)
RETURNS TABLE(part_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT uf.part_id
  FROM user_favorites uf
  WHERE uf.user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get part save count
CREATE OR REPLACE FUNCTION get_part_save_count(part_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM part_saves
    WHERE part_id = part_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get part chat count
CREATE OR REPLACE FUNCTION get_part_chat_count(part_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM part_chats
    WHERE part_id = part_uuid AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get part recent views
CREATE OR REPLACE FUNCTION get_part_recent_views(part_uuid UUID, days_back INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM part_view_logs
    WHERE part_id = part_uuid
    AND viewed_at >= NOW() - INTERVAL '1 day' * days_back
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread message count for a user
CREATE OR REPLACE FUNCTION get_unread_message_count(user_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM part_chat_messages m
    JOIN part_chats c ON m.chat_id = c.id
    LEFT JOIN message_read_status r ON m.id = r.message_id AND r.user_id = user_uuid
    WHERE (c.buyer_id = user_uuid OR c.seller_id = user_uuid)
    AND m.sender_id != user_uuid
    AND r.id IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get chat list with unread counts
CREATE OR REPLACE FUNCTION get_user_chats_with_unread(user_uuid UUID)
RETURNS TABLE (
  chat_id UUID,
  part_id UUID,
  part_name TEXT,
  part_image TEXT,
  other_user_id UUID,
  other_user_name TEXT,
  other_user_avatar TEXT,
  last_message_text TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE,
  unread_count INTEGER,
  phone_revealed BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as chat_id,
    p.id as part_id,
    p.name as part_name,
    p.image_url as part_image,
    CASE 
      WHEN c.buyer_id = user_uuid THEN c.seller_id
      ELSE c.buyer_id
    END as other_user_id,
    CASE 
      WHEN c.buyer_id = user_uuid THEN up_seller.full_name
      ELSE up_buyer.full_name
    END as other_user_name,
    CASE 
      WHEN c.buyer_id = user_uuid THEN up_seller.avatar_url
      ELSE up_buyer.avatar_url
    END as other_user_avatar,
    m.message_text as last_message_text,
    m.created_at as last_message_at,
    (
      SELECT COUNT(*)::INTEGER
      FROM part_chat_messages m2
      LEFT JOIN message_read_status r ON m2.id = r.message_id AND r.user_id = user_uuid
      WHERE m2.chat_id = c.id
      AND m2.sender_id != user_uuid
      AND r.id IS NULL
    ) as unread_count,
    (c.phone_revealed_by_buyer AND c.phone_revealed_by_seller) as phone_revealed
  FROM part_chats c
  JOIN parts p ON c.part_id = p.id
  LEFT JOIN user_profiles up_buyer ON c.buyer_id = up_buyer.user_id
  LEFT JOIN user_profiles up_seller ON c.seller_id = up_seller.user_id
  LEFT JOIN part_chat_messages m ON c.id = m.chat_id
  WHERE (c.buyer_id = user_uuid OR c.seller_id = user_uuid)
  AND c.is_active = true
  AND m.id = (
    SELECT id FROM part_chat_messages 
    WHERE chat_id = c.id 
    ORDER BY created_at DESC 
    LIMIT 1
  )
  ORDER BY c.last_message_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
