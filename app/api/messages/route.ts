import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(cookies())
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's chats with related data using direct query instead of RPC
    // This avoids the ambiguous column reference issue in the database function
    const { data: chats, error } = await supabase
      .from('part_chats')
      .select(`
        id,
        part_id,
        buyer_id,
        seller_id,
        is_active,
        last_message_at,
        phone_revealed_by_buyer,
        phone_revealed_by_seller,
        parts!inner (
          id,
          name,
          image_url
        ),
        part_chat_messages (
          id,
          message_text,
          created_at,
          sender_id
        )
      `)
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .eq('is_active', true)
      .order('last_message_at', { ascending: false })

    if (error) {
      logger.error('Error fetching chats:', error)
      return NextResponse.json({ error: 'Failed to fetch chats' }, { status: 500 })
    }

    // Get user profiles for the other users in each chat
    const otherUserIds = new Set<string>()
    chats?.forEach(chat => {
      if (chat.buyer_id === user.id) {
        otherUserIds.add(chat.seller_id)
      } else {
        otherUserIds.add(chat.buyer_id)
      }
    })

    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('user_id, full_name, avatar_url')
      .in('user_id', Array.from(otherUserIds))

    const profilesMap = new Map(profiles?.map(p => [p.user_id, p]) || [])

    // Get unread counts for each chat
    const { data: readStatuses } = await supabase
      .from('message_read_status')
      .select('message_id')
      .eq('user_id', user.id)

    const readMessageIds = new Set(readStatuses?.map(r => r.message_id) || [])

    // Transform the data to match the expected format
    const transformedChats = chats?.map(chat => {
      const part = Array.isArray(chat.parts) ? chat.parts[0] : chat.parts
      const messages = chat.part_chat_messages || []
      const lastMessage = messages.sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0]

      const otherUserId = chat.buyer_id === user.id ? chat.seller_id : chat.buyer_id
      const otherUserProfile = profilesMap.get(otherUserId)

      // Count unread messages (messages from other user that haven't been read)
      const unreadCount = messages.filter((m: any) => 
        m.sender_id !== user.id && !readMessageIds.has(m.id)
      ).length

      return {
        chat_id: chat.id,
        part_id: part?.id,
        part_name: part?.name,
        part_image: part?.image_url,
        other_user_id: otherUserId,
        other_user_name: otherUserProfile?.full_name || 'Unknown User',
        other_user_avatar: otherUserProfile?.avatar_url,
        last_message_text: lastMessage?.message_text,
        last_message_at: lastMessage?.created_at || chat.last_message_at,
        unread_count: unreadCount,
        phone_revealed: chat.phone_revealed_by_buyer && chat.phone_revealed_by_seller
      }
    }) || []

    return NextResponse.json({ chats: transformedChats })
  } catch (error) {
    logger.error('Error in GET /api/messages:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient(cookies())
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

    const shop = Array.isArray(part.shops) ? part.shops[0] : part.shops
    const sellerId = shop?.user_id
    if (!sellerId) {
      logger.error('Seller not found for part:', partId)
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 })
    }

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
      logger.error('Error finding chat:', chatError)
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
        logger.error('Error creating chat:', createChatError)
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
      logger.error('Error creating message:', messageError)
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    // Trigger notifications (fire and forget)
    // VULN-023 FIX: Standardize on NEXT_PUBLIC_APP_URL with fallbacks
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || ''
    
    // MED-002 FIX: Include internal API key for server-to-server notification calls
    const internalHeaders = {
      'Content-Type': 'application/json',
      'X-Internal-API-Key': process.env.INTERNAL_API_KEY || ''
    }
    
    try {
      // Send email notification
      fetch(`${appUrl}/api/notifications/email`, {
        method: 'POST',
        headers: internalHeaders,
        body: JSON.stringify({
          chatId: chat.id,
          messageId: newMessage.id,
          type: 'new_message'
        })
      }).catch(err => logger.error('Email notification error:', err))

      // Send push notification
      fetch(`${appUrl}/api/notifications/push`, {
        method: 'POST',
        headers: internalHeaders,
        body: JSON.stringify({
          chatId: chat.id,
          messageId: newMessage.id,
          type: 'new_message'
        })
      }).catch(err => logger.error('Push notification error:', err))
    } catch (error) {
      logger.error('Notification trigger error:', error)
    }

    return NextResponse.json({ message: newMessage, chatId: chat.id })
  } catch (error) {
    logger.error('Error in POST /api/messages:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
