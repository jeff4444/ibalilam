import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('user_role')
      .eq('user_id', user.id)
      .single()

    if (profileError || profile?.user_role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { targetUserId, action, reason } = await request.json()

    if (!targetUserId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['verified', 'rejected'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    if (action === 'rejected' && !reason) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 })
    }

    // Update FICA status using the database function
    const { error: updateError } = await supabase.rpc('update_fica_status', {
      p_user_id: targetUserId,
      p_status: action,
      p_reason: reason || null
    })

    if (updateError) {
      console.error('Error updating FICA status:', updateError)
      return NextResponse.json({ error: 'Failed to update FICA status' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in FICA review API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('user_role')
      .eq('user_id', user.id)
      .single()

    if (profileError || profile?.user_role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    // Build query
    let query = supabase
      .from('user_profiles')
      .select(`
        *,
        auth_users:user_id (
          email
        )
      `)
      .not('fica_status', 'is', null)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('fica_status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching FICA reviews:', error)
      return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 })
    }

    // Transform data to include email
    const transformedData = data.map(user => ({
      ...user,
      email: user.auth_users?.email || 'N/A'
    }))

    return NextResponse.json({ data: transformedData })
  } catch (error) {
    console.error('Error in FICA review GET API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
