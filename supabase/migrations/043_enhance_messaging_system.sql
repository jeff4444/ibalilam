-- Enhance messaging system with phone reveal, notifications, and safety features

-- Add phone reveal functionality to part_chats table
ALTER TABLE part_chats 
ADD COLUMN IF NOT EXISTS phone_revealed_by_buyer BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS phone_revealed_by_seller BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS phone_revealed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS safety_tips_shown BOOLEAN DEFAULT false;

-- Add notification preferences to user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS push_notifications BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS message_notifications BOOLEAN DEFAULT true;

-- Create message_read_status table for tracking read receipts
CREATE TABLE IF NOT EXISTS message_read_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES part_chat_messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one read status per user per message
  UNIQUE(message_id, user_id)
);

-- Create chat_notifications table for managing notifications
CREATE TABLE IF NOT EXISTS chat_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID REFERENCES part_chats(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  notification_type TEXT CHECK (notification_type IN ('new_message', 'phone_revealed', 'chat_started')) NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create safety_tips_shown table to track which users have seen safety tips
CREATE TABLE IF NOT EXISTS safety_tips_shown (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  shown_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one record per user
  UNIQUE(user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_message_read_status_message_id ON message_read_status(message_id);
CREATE INDEX IF NOT EXISTS idx_message_read_status_user_id ON message_read_status(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_notifications_chat_id ON chat_notifications(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_notifications_user_id ON chat_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_notifications_is_read ON chat_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_safety_tips_shown_user_id ON safety_tips_shown(user_id);

-- Enable Row Level Security
ALTER TABLE message_read_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_tips_shown ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for message_read_status
CREATE POLICY "Users can view read status for their messages" ON message_read_status
  FOR SELECT USING (
    user_id = auth.uid() OR
    message_id IN (
      SELECT m.id FROM part_chat_messages m
      JOIN part_chats c ON m.chat_id = c.id
      WHERE c.buyer_id = auth.uid() OR c.seller_id = auth.uid()
    )
  );

CREATE POLICY "Users can mark messages as read" ON message_read_status
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Create RLS policies for chat_notifications
CREATE POLICY "Users can view their own notifications" ON chat_notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications" ON chat_notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "System can create notifications" ON chat_notifications
  FOR INSERT WITH CHECK (true);

-- Create RLS policies for safety_tips_shown
CREATE POLICY "Users can view their own safety tips status" ON safety_tips_shown
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can mark safety tips as shown" ON safety_tips_shown
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Create function to update last_message_at when new message is added
CREATE OR REPLACE FUNCTION update_chat_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE part_chats 
  SET last_message_at = NEW.created_at
  WHERE id = NEW.chat_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update last_message_at
CREATE TRIGGER trigger_update_chat_last_message
  AFTER INSERT ON part_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_last_message();

-- Create function to create notification when new message is added
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

-- Create trigger to create notifications
CREATE TRIGGER trigger_create_message_notification
  AFTER INSERT ON part_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION create_message_notification();

-- Create function to get unread message count for a user
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

-- Create function to get chat list with unread counts
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

-- Update existing RLS policies to allow phone reveal functionality
DROP POLICY IF EXISTS "Users can update chats they participate in" ON part_chats;
CREATE POLICY "Users can update chats they participate in" ON part_chats
  FOR UPDATE USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Add policy to allow users to update their own notification preferences
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);
