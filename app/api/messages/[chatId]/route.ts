import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { chatId } = await params
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user has access to this chat
    const { data: chat, error: chatError } = await supabase
      .from('part_chats')
      .select(`
        id,
        part_id,
        buyer_id,
        seller_id,
        phone_revealed_by_buyer,
        phone_revealed_by_seller,
        phone_revealed_at,
        safety_tips_shown,
        parts!inner(
          id,
          name,
          image_url,
          price,
          shops!inner(
            id,
            name,
            user_id
          )
        )
      `)
      .eq('id', chatId)
      .single()

    if (chatError || !chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    if (chat.buyer_id !== user.id && chat.seller_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get messages for this chat
    const { data: messages, error: messagesError } = await supabase
      .from('part_chat_messages')
      .select(`
        id,
        sender_id,
        message_text,
        message_type,
        file_url,
        is_read,
        created_at,
        user_profiles!sender_id(
          first_name,
          last_name,
          full_name
        )
      `)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })

    if (messagesError) {
      console.error('Error fetching messages:', messagesError)
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    // Get other user's profile
    const otherUserId = chat.buyer_id === user.id ? chat.seller_id : chat.buyer_id
    const { data: otherUser, error: userError } = await supabase
      .from('user_profiles')
      .select('first_name, last_name, full_name, phone, avatar_url')
      .eq('user_id', otherUserId)
      .single()

    if (userError) {
      console.error('Error fetching other user:', userError)
    }

    // Mark messages as read
    const unreadMessageIds = messages
      ?.filter(m => m.sender_id !== user.id && !m.is_read)
      .map(m => m.id) || []

    if (unreadMessageIds.length > 0) {
      await supabase
        .from('message_read_status')
        .upsert(
          unreadMessageIds.map(messageId => ({
            message_id: messageId,
            user_id: user.id
          })),
          { onConflict: 'message_id,user_id' }
        )
    }

    return NextResponse.json({
      chat,
      messages,
      otherUser: otherUser || null
    })
  } catch (error) {
    console.error('Error in GET /api/messages/[chatId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { chatId } = await params
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { message, messageType = 'text', fileUrl } = body

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Verify user has access to this chat
    const { data: chat, error: chatError } = await supabase
      .from('part_chats')
      .select('id, buyer_id, seller_id')
      .eq('id', chatId)
      .single()

    if (chatError || !chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    if (chat.buyer_id !== user.id && chat.seller_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Create message
    const { data: newMessage, error: messageError } = await supabase
      .from('part_chat_messages')
      .insert({
        chat_id: chatId,
        sender_id: user.id,
        message_text: message,
        message_type: messageType,
        file_url: fileUrl
      })
      .select(`
        id,
        sender_id,
        message_text,
        message_type,
        file_url,
        is_read,
        created_at,
        user_profiles!sender_id(
          first_name,
          last_name,
          full_name
        )
      `)
      .single()

    if (messageError) {
      console.error('Error creating message:', messageError)
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    // Trigger notifications (fire and forget)
    try {
      // Send email notification
      fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/notifications/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          messageId: newMessage.id,
          type: 'new_message'
        })
      }).catch(err => console.error('Email notification error:', err))

      // Send push notification
      fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/notifications/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          messageId: newMessage.id,
          type: 'new_message'
        })
      }).catch(err => console.error('Push notification error:', err))
    } catch (error) {
      console.error('Notification trigger error:', error)
    }

    return NextResponse.json({ message: newMessage })
  } catch (error) {
    console.error('Error in POST /api/messages/[chatId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
