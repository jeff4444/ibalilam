import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
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

    // Get message details
    const { data: message, error: messageError } = await supabase
      .from('part_chat_messages')
      .select(`
        id,
        sender_id,
        message_text,
        message_type,
        file_url,
        created_at,
        user_profiles!sender_id(
          first_name,
          last_name,
          full_name
        )
      `)
      .eq('id', messageId)
      .single()

    if (messageError || !message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    // Determine recipient
    const recipientId = chat.buyer_id === user.id ? chat.seller_id : chat.buyer_id

    // Get recipient's email and notification preferences
    const { data: recipient, error: recipientError } = await supabase
      .from('user_profiles')
      .select('email_notifications, message_notifications')
      .eq('user_id', recipientId)
      .single()

    if (recipientError || !recipient) {
      return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })
    }

    // Check if recipient wants email notifications
    if (!recipient.email_notifications || !recipient.message_notifications) {
      return NextResponse.json({ message: 'Notifications disabled for recipient' })
    }

    // Get recipient's email from auth.users
    const { data: authUser, error: authUserError } = await supabase.auth.admin.getUserById(recipientId)
    
    if (authUserError || !authUser.user?.email) {
      return NextResponse.json({ error: 'Recipient email not found' }, { status: 404 })
    }

    // Send email notification
    const emailData = {
      to: authUser.user.email,
      subject: `New message about ${chat.parts.name}`,
      template: 'new-message',
      data: {
        senderName: message.user_profiles?.full_name || 
                   `${message.user_profiles?.first_name || ''} ${message.user_profiles?.last_name || ''}`.trim() ||
                   'Someone',
        partName: chat.parts.name,
        partImage: chat.parts.image_url,
        messageText: message.message_text,
        messageType: message.message_type,
        chatUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/messages?chat=${chatId}`,
        partUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/parts/${chat.parts.id}`
      }
    }

    // Here you would integrate with your email service (SendGrid, Resend, etc.)
    // For now, we'll just log the email data
    console.log('Email notification data:', emailData)

    // In a real implementation, you would send the email here
    // Example with Resend:
    // const response = await fetch('https://api.resend.com/emails', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify(emailData),
    // })

    return NextResponse.json({ message: 'Email notification sent' })
  } catch (error) {
    console.error('Error in POST /api/notifications/email:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
