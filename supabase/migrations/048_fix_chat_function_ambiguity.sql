-- Fix ambiguous chat_id reference in chat listing function

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
    WHERE part_chat_messages.chat_id = c.id 
    ORDER BY created_at DESC 
    LIMIT 1
  )
  ORDER BY c.last_message_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

