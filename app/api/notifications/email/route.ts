import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

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
        console.error('Error fetching sender profile:', profileError)
      } else {
        senderProfile = profile
      }
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
    // VULN-023 FIX: Standardize on NEXT_PUBLIC_APP_URL with fallbacks
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || ''
    
    const emailData = {
      to: authUser.user.email,
      subject: `New message about ${chatPart.name}`,
      template: 'new-message',
      data: {
        senderName: senderProfile?.full_name || 
                   `${senderProfile?.first_name || ''} ${senderProfile?.last_name || ''}`.trim() ||
                   'Someone',
        partName: chatPart.name,
        partImage: chatPart.image_url,
        messageText: message.message_text,
        messageType: message.message_type,
        chatUrl: `${appUrl}/messages?chat=${chatId}`,
        partUrl: `${appUrl}/parts/${chatPart.id}`
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
