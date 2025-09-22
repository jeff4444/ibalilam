import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

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

    // Verify user has access to this chat
    const { data: chat, error: chatError } = await supabase
      .from('part_chats')
      .select('id, buyer_id, seller_id, phone_revealed_by_buyer, phone_revealed_by_seller')
      .eq('id', chatId)
      .single()

    if (chatError || !chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    if (chat.buyer_id !== user.id && chat.seller_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Determine if user is buyer or seller
    const isBuyer = chat.buyer_id === user.id
    const isSeller = chat.seller_id === user.id

    // Check if user has already revealed their phone
    if ((isBuyer && chat.phone_revealed_by_buyer) || (isSeller && chat.phone_revealed_by_seller)) {
      return NextResponse.json({ error: 'Phone number already revealed' }, { status: 400 })
    }

    // Update chat to mark phone as revealed by this user
    const updateData: any = {}
    if (isBuyer) {
      updateData.phone_revealed_by_buyer = true
    } else {
      updateData.phone_revealed_by_seller = true
    }

    // If both users have revealed their phones, set the revealed_at timestamp
    if ((isBuyer && chat.phone_revealed_by_seller) || (isSeller && chat.phone_revealed_by_buyer)) {
      updateData.phone_revealed_at = new Date().toISOString()
    }

    const { error: updateError } = await supabase
      .from('part_chats')
      .update(updateData)
      .eq('id', chatId)

    if (updateError) {
      console.error('Error updating chat:', updateError)
      return NextResponse.json({ error: 'Failed to reveal phone number' }, { status: 500 })
    }

    // Create notification for the other user
    const otherUserId = isBuyer ? chat.seller_id : chat.buyer_id
    await supabase
      .from('chat_notifications')
      .insert({
        chat_id: chatId,
        user_id: otherUserId,
        notification_type: 'phone_revealed'
      })

    return NextResponse.json({ 
      success: true, 
      phoneRevealed: (isBuyer && chat.phone_revealed_by_seller) || (isSeller && chat.phone_revealed_by_buyer)
    })
  } catch (error) {
    console.error('Error in POST /api/messages/[chatId]/reveal-phone:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
