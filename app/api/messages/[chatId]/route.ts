import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { logger } from '@/lib/logger'

async function enrichMessagesWithProfiles(
  supabase: any,
  messages: Array<Record<string, any>>
) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return []
  }

  const senderIds = Array.from(
    new Set(
      messages
        .map(message => message?.sender_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    )
  )

  if (senderIds.length === 0) {
    return messages.map(message => ({ ...message, user_profiles: null }))
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('user_profiles')
    .select('user_id, first_name, last_name, full_name')
    .in('user_id', senderIds)

  if (profilesError) {
    logger.error('Error fetching sender profiles:', profilesError)
    return messages.map(message => ({ ...message, user_profiles: null }))
  }

  const profileMap: Record<string, any> = {}

  if (Array.isArray(profiles)) {
    profiles.forEach((profile: Record<string, any>) => {
      const userId = typeof profile?.user_id === 'string' ? profile.user_id : null
      if (userId) {
        profileMap[userId] = profile
      }
    })
  }

  return messages.map(message => ({
    ...message,
    user_profiles: profileMap[message?.sender_id as string] ?? null
  }))
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { chatId } = await params
    const supabase = await createClient(cookies())
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
    const { data: messagesData, error: messagesError } = await supabase
      .from('part_chat_messages')
      .select(`
        id,
        sender_id,
        message_text,
        message_type,
        file_url,
        is_read,
        created_at
      `)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })

    if (messagesError) {
      logger.error('Error fetching messages:', messagesError)
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    const baseMessages = messagesData ?? []
    const messages = await enrichMessagesWithProfiles(supabase, baseMessages)

    // Get other user's profile
    const otherUserId = chat.buyer_id === user.id ? chat.seller_id : chat.buyer_id
    const { data: otherUser, error: userError } = await supabase
      .from('user_profiles')
      .select('first_name, last_name, full_name, phone, avatar_url')
      .eq('user_id', otherUserId)
      .single()

    if (userError) {
      logger.error('Error fetching other user:', userError)
    }

    // Mark messages as read
    const unreadMessageIds = baseMessages
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
    logger.error('Error in GET /api/messages/[chatId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { chatId } = await params
    const supabase = await createClient(cookies())
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
      .select('*')
      .single()

    if (messageError) {
      logger.error('Error creating message:', messageError)
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    const [messageWithProfile] = await enrichMessagesWithProfiles(
      supabase,
      newMessage ? [newMessage] : []
    )

    // Trigger notifications (fire and forget)
    // VULN-023 FIX: Standardize on NEXT_PUBLIC_APP_URL with fallbacks
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || ''
    
    try {
      // Send email notification
      fetch(`${appUrl}/api/notifications/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          messageId: newMessage.id,
          type: 'new_message'
        })
      }).catch(err => logger.error('Email notification error:', err))

      // Send push notification
      fetch(`${appUrl}/api/notifications/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          messageId: newMessage.id,
          type: 'new_message'
        })
      }).catch(err => logger.error('Push notification error:', err))
    } catch (error) {
      logger.error('Notification trigger error:', error)
    }

    return NextResponse.json({ message: messageWithProfile || newMessage })
  } catch (error) {
    logger.error('Error in POST /api/messages/[chatId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
