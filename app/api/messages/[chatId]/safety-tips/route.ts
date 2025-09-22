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
      .select('id, buyer_id, seller_id')
      .eq('id', chatId)
      .single()

    if (chatError || !chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    if (chat.buyer_id !== user.id && chat.seller_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Mark safety tips as shown for this user
    await supabase
      .from('safety_tips_shown')
      .upsert({
        user_id: user.id
      }, {
        onConflict: 'user_id'
      })

    // Update chat to mark safety tips as shown
    await supabase
      .from('part_chats')
      .update({ safety_tips_shown: true })
      .eq('id', chatId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in POST /api/messages/[chatId]/safety-tips:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
