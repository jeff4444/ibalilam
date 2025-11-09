import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient(cookies())
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse the request body
    const body = await request.json()
    const { sellerId, subject, regardingPart, message } = body

    if (!sellerId || !subject || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Fetch seller information
    const { data: shopData, error: shopError } = await supabase
      .from('shops')
      .select(`
        *,
        user_profiles (
          first_name,
          last_name,
          location,
          bio
        )
      `)
      .eq('id', sellerId)
      .eq('is_active', true)
      .single()

    if (shopError || !shopData) {
      return NextResponse.json(
        { error: 'Seller not found' },
        { status: 404 }
      )
    }

    // Get seller's email from auth.users (we'll need to fetch this)
    const { data: sellerUser, error: sellerUserError } = await supabase.auth.admin.getUserById(shopData.user_id)
    
    if (sellerUserError || !sellerUser.user?.email) {
      return NextResponse.json(
        { error: 'Seller email not found' },
        { status: 404 }
      )
    }

    // Get current user's profile for reply-to
    const { data: currentUserProfile } = await supabase
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('user_id', user.id)
      .single()

    // Prepare email content
    const sellerName = shopData.user_profiles?.first_name && shopData.user_profiles?.last_name
      ? `${shopData.user_profiles.first_name} ${shopData.user_profiles.last_name}`
      : shopData.name

    const buyerName = currentUserProfile?.first_name && currentUserProfile?.last_name
      ? `${currentUserProfile.first_name} ${currentUserProfile.last_name}`
      : user.email

    const emailSubject = `[Techafon] ${subject}`
    
    const emailBody = `
Hello ${sellerName},

You have received a new message from a potential buyer on Techafon:

From: ${buyerName} (${user.email})
Subject: ${subject}
${regardingPart ? `Regarding Part: ${regardingPart}` : ''}

Message:
${message}

---
This message was sent through Techafon. Please reply directly to this email to respond to the buyer.

Best regards,
The Techafon Team
    `.trim()

    // For now, we'll log the email (in production, you'd use a service like SendGrid, Resend, etc.)
    console.log('=== EMAIL TO BE SENT ===')
    console.log('To:', sellerUser.user.email)
    console.log('Reply-To:', user.email)
    console.log('Subject:', emailSubject)
    console.log('Body:', emailBody)
    console.log('========================')

    // TODO: Replace with actual email service
    // Example with Resend:
    // const resend = new Resend(process.env.RESEND_API_KEY)
    // await resend.emails.send({
    //   from: 'noreply@techafon.com',
    //   to: sellerUser.user.email,
    //   replyTo: user.email,
    //   subject: emailSubject,
    //   text: emailBody,
    // })

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully'
    })

  } catch (error) {
    console.error('Error sending email:', error)
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    )
  }
}
