-- Create tables for tracking part interactions (saves, chats, etc.)

-- Create part_saves table to track when users save/favorite parts
CREATE TABLE IF NOT EXISTS part_saves (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  part_id UUID REFERENCES parts(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure a user can only save a part once
  UNIQUE(user_id, part_id)
);

-- Create part_chats table for messaging between buyers and sellers about specific parts
CREATE TABLE IF NOT EXISTS part_chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  part_id UUID REFERENCES parts(id) ON DELETE CASCADE NOT NULL,
  buyer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one chat per buyer-seller-part combination
  UNIQUE(part_id, buyer_id, seller_id)
);

-- Create part_chat_messages table for individual messages
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

-- Create part_view_logs table for detailed view tracking
CREATE TABLE IF NOT EXISTS part_view_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  part_id UUID REFERENCES parts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL for anonymous views
  ip_address INET,
  user_agent TEXT,
  referrer TEXT,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_part_saves_user_id ON part_saves(user_id);
CREATE INDEX IF NOT EXISTS idx_part_saves_part_id ON part_saves(part_id);
CREATE INDEX IF NOT EXISTS idx_part_chats_part_id ON part_chats(part_id);
CREATE INDEX IF NOT EXISTS idx_part_chats_buyer_id ON part_chats(buyer_id);
CREATE INDEX IF NOT EXISTS idx_part_chats_seller_id ON part_chats(seller_id);
CREATE INDEX IF NOT EXISTS idx_part_chat_messages_chat_id ON part_chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_part_chat_messages_sender_id ON part_chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_part_view_logs_part_id ON part_view_logs(part_id);
CREATE INDEX IF NOT EXISTS idx_part_view_logs_user_id ON part_view_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_part_view_logs_viewed_at ON part_view_logs(viewed_at);

-- Enable Row Level Security
ALTER TABLE part_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE part_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE part_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE part_view_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for part_saves
CREATE POLICY "Users can view their own saves" ON part_saves
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can add their own saves" ON part_saves
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saves" ON part_saves
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for part_chats
CREATE POLICY "Users can view chats they participate in" ON part_chats
  FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Users can create chats as buyers" ON part_chats
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);

-- Create RLS policies for part_chat_messages
CREATE POLICY "Users can view messages in their chats" ON part_chat_messages
  FOR SELECT USING (
    chat_id IN (
      SELECT id FROM part_chats 
      WHERE buyer_id = auth.uid() OR seller_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages in their chats" ON part_chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    chat_id IN (
      SELECT id FROM part_chats 
      WHERE buyer_id = auth.uid() OR seller_id = auth.uid()
    )
  );

-- Create RLS policies for part_view_logs (more permissive for analytics)
CREATE POLICY "Users can view view logs for their own parts" ON part_view_logs
  FOR SELECT USING (
    part_id IN (
      SELECT p.id FROM parts p
      JOIN shops s ON p.shop_id = s.id
      WHERE s.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can insert view logs" ON part_view_logs
  FOR INSERT WITH CHECK (true);

-- Create functions for analytics
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

-- Create trigger to update part views count
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

CREATE TRIGGER trigger_update_part_views_count
  AFTER INSERT ON part_view_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_part_views_count();
