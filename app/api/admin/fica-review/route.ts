import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { supabaseAdmin } from '@/utils/supabase/admin'
import { verifyAdmin } from '@/lib/auth-utils'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    // Get user from request cookies (authenticated session)
    const supabase = await createClient(cookies())
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin status from admins table using admin client
    const adminInfo = await verifyAdmin(supabaseAdmin, user.id)
    if (!adminInfo.isAdmin) {
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

    // Update FICA status directly using admin client
    // We do this instead of using the RPC function because auth.uid() is null with service role
    const updateData: Record<string, unknown> = {
      fica_status: action,
      fica_reviewed_by: user.id,
      fica_reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (action === 'verified') {
      updateData.fica_verified_at = new Date().toISOString()
      updateData.fica_rejection_reason = null
    } else if (action === 'rejected') {
      updateData.fica_rejection_reason = reason
      updateData.fica_verified_at = null
    }

    const { error: updateError } = await supabaseAdmin
      .from('user_profiles')
      .update(updateData)
      .eq('user_id', targetUserId)

    if (updateError) {
      console.error('Error updating FICA status:', updateError)
      return NextResponse.json({ error: 'Failed to update FICA status' }, { status: 500 })
    }

    // Log the action in audit log
    const auditAction = action === 'verified' ? 'approved' : 'rejected'
    const { error: logError } = await supabaseAdmin
      .from('fica_audit_log')
      .insert({
        user_id: targetUserId,
        action: auditAction,
        performed_by: user.id,
        reason: reason || null
      })

    if (logError) {
      console.error('Error logging FICA action:', logError)
      // Don't fail the request if logging fails
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in FICA review API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get user from request cookies (authenticated session)
    const supabase = await createClient(cookies())
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin status from admins table using admin client
    const adminInfo = await verifyAdmin(supabaseAdmin, user.id)
    if (!adminInfo.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    // Build query using admin client
    let query = supabaseAdmin
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
