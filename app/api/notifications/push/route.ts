import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient(cookies())
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { chatId, messageId, type } = body

    if (!chatId || !messageId || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get chat details
    const { data: chat, error: chatError } = await supabase
      .from('part_chats')
      .select(`
        id,
        buyer_id,
        seller_id,
        parts!inner(
          id,
          name,
          image_url,
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

    const chatPart = Array.isArray(chat.parts) ? chat.parts[0] : chat.parts
    const chatShop = chatPart && Array.isArray(chatPart.shops) ? chatPart.shops[0] : chatPart?.shops

    if (!chatPart || !chatShop) {
      return NextResponse.json({ error: 'Part or shop details not found' }, { status: 404 })
    }

    // Get message details
    const { data: message, error: messageError } = await supabase
      .from('part_chat_messages')
      .select(`
        id,
        sender_id,
        message_text,
        message_type,
        file_url,
        created_at
      `)
      .eq('id', messageId)
      .single()

    if (messageError || !message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    let senderProfile: Record<string, any> | null = null

    if (message.sender_id) {
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('user_id, first_name, last_name, full_name')
        .eq('user_id', message.sender_id)
        .single()

      if (profileError) {
        logger.error('Error fetching sender profile:', profileError)
      } else {
        senderProfile = profile
      }
    }

    const senderName =
      senderProfile?.full_name ||
      `${senderProfile?.first_name || ''} ${senderProfile?.last_name || ''}`.trim() ||
      'Someone'

    // Determine recipient
    const recipientId = chat.buyer_id === user.id ? chat.seller_id : chat.buyer_id

    // Get recipient's notification preferences
    const { data: recipient, error: recipientError } = await supabase
      .from('user_profiles')
      .select('push_notifications, message_notifications')
      .eq('user_id', recipientId)
      .single()

    if (recipientError || !recipient) {
      return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })
    }

    // Check if recipient wants push notifications
    if (!recipient.push_notifications || !recipient.message_notifications) {
      return NextResponse.json({ message: 'Push notifications disabled for recipient' })
    }

    // Get recipient's push subscription (this would be stored in a separate table)
    // For now, we'll create a placeholder structure
    const pushNotificationData = {
      recipientId,
      title: `New message about ${chatPart.name}`,
      body: message.message_text.length > 100 
        ? `${message.message_text.substring(0, 100)}...`
        : message.message_text,
      icon: chatPart.image_url || '/placeholder.svg',
      badge: '/badge-icon.png',
      data: {
        chatId,
        partId: chatPart.id,
        messageId,
        type: 'new_message',
        url: `/messages?chat=${chatId}`,
        senderName
      },
      actions: [
        {
          action: 'view',
          title: 'View Message',
          icon: '/message-icon.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/dismiss-icon.png'
        }
      ]
    }

    // Here you would integrate with your push notification service
    // For now, we'll just log the notification data
    logger.debug('Push notification data:', pushNotificationData)

    // In a real implementation, you would send the push notification here
    // Example with Web Push API or a service like OneSignal:
    // const response = await fetch('https://onesignal.com/api/v1/notifications', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Basic ${process.env.ONESIGNAL_API_KEY}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     app_id: process.env.ONESIGNAL_APP_ID,
    //     include_player_ids: [recipientPushToken],
    //     headings: { en: pushNotificationData.title },
    //     contents: { en: pushNotificationData.body },
    //     data: pushNotificationData.data
    //   }),
    // })

    return NextResponse.json({ message: 'Push notification sent' })
  } catch (error) {
    logger.error('Error in POST /api/notifications/push:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
