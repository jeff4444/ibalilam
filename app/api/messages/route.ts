import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's chats with unread counts
    const { data: chats, error } = await supabase.rpc('get_user_chats_with_unread', {
      user_uuid: user.id
    })

    if (error) {
      console.error('Error fetching chats:', error)
      return NextResponse.json({ error: 'Failed to fetch chats' }, { status: 500 })
    }

    return NextResponse.json({ chats })
  } catch (error) {
    console.error('Error in GET /api/messages:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { partId, message, messageType = 'text', fileUrl } = body

    if (!partId || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get part details to find seller
    const { data: part, error: partError } = await supabase
      .from('parts')
      .select('shop_id, shops!inner(user_id)')
      .eq('id', partId)
      .single()

    if (partError || !part) {
      return NextResponse.json({ error: 'Part not found' }, { status: 404 })
    }

    const sellerId = part.shops.user_id

    // Check if user is trying to message themselves
    if (user.id === sellerId) {
      return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 })
    }

    // Find or create chat
    let { data: chat, error: chatError } = await supabase
      .from('part_chats')
      .select('id')
      .eq('part_id', partId)
      .eq('buyer_id', user.id)
      .eq('seller_id', sellerId)
      .single()

    if (chatError && chatError.code !== 'PGRST116') {
      console.error('Error finding chat:', chatError)
      return NextResponse.json({ error: 'Failed to find chat' }, { status: 500 })
    }

    // Create chat if it doesn't exist
    if (!chat) {
      const { data: newChat, error: createChatError } = await supabase
        .from('part_chats')
        .insert({
          part_id: partId,
          buyer_id: user.id,
          seller_id: sellerId,
          is_active: true
        })
        .select('id')
        .single()

      if (createChatError) {
        console.error('Error creating chat:', createChatError)
        return NextResponse.json({ error: 'Failed to create chat' }, { status: 500 })
      }

      chat = newChat
    }

    // Create message
    const { data: newMessage, error: messageError } = await supabase
      .from('part_chat_messages')
      .insert({
        chat_id: chat.id,
        sender_id: user.id,
        message_text: message,
        message_type: messageType,
        file_url: fileUrl
      })
      .select('*')
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
          chatId: chat.id,
          messageId: newMessage.id,
          type: 'new_message'
        })
      }).catch(err => console.error('Email notification error:', err))

      // Send push notification
      fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/notifications/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: chat.id,
          messageId: newMessage.id,
          type: 'new_message'
        })
      }).catch(err => console.error('Push notification error:', err))
    } catch (error) {
      console.error('Notification trigger error:', error)
    }

    return NextResponse.json({ message: newMessage, chatId: chat.id })
  } catch (error) {
    console.error('Error in POST /api/messages:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
