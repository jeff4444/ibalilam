import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(cookies(), true)
    
    // Verify admin status
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const role = searchParams.get('role') || ''
    const ficaStatus = searchParams.get('fica_status') || ''
    const status = searchParams.get('status') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('user_profiles')
      .select('*', { count: 'exact' })

    // Apply search filter
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`)
    }

    // Apply role filter
    if (role && role !== 'all') {
      if (role === 'admin') {
        query = query.eq('is_admin', true)
      } else {
        query = query.eq('user_role', role)
      }
    }

    // Apply FICA status filter
    if (ficaStatus && ficaStatus !== 'all') {
      if (ficaStatus === 'null') {
        query = query.is('fica_status', null)
      } else {
        query = query.eq('fica_status', ficaStatus)
      }
    }

    // Apply account status filter
    if (status && status !== 'all') {
      if (status === 'suspended') {
        query = query.eq('is_suspended', true)
      } else if (status === 'active') {
        query = query.eq('is_suspended', false)
      }
    }

    // Apply pagination and ordering
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) throw error

    // Transform data to match expected format
    const users = data?.map(profile => ({
      id: profile.user_id,
      full_name: profile.full_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'No name',
      user_role: profile.user_role || 'visitor',
      is_admin: Boolean(profile.is_admin),
      fica_status: profile.fica_status,
      fica_rejection_reason: profile.fica_rejection_reason,
      fica_verified_at: profile.fica_verified_at,
      is_suspended: profile.is_suspended || false,
      suspension_reason: profile.suspension_reason,
      suspension_until: profile.suspension_until,
      created_at: profile.created_at,
      updated_at: profile.updated_at
    })) || []

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient(cookies(), true)
    
    // Verify admin status
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { user_id, action, ...updateData } = body

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    // Handle different actions
    if (action === 'suspend') {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          is_suspended: true,
          suspension_reason: updateData.suspension_reason,
          suspension_until: updateData.suspension_until
        })
        .eq('user_id', user_id)

      if (error) throw error
    } else if (action === 'unsuspend') {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          is_suspended: false,
          suspension_reason: null,
          suspension_until: null
        })
        .eq('user_id', user_id)

      if (error) throw error
    } else if (action === 'approve_fica') {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          fica_status: 'verified',
          fica_verified_at: new Date().toISOString(),
          fica_reviewed_by: user.id,
          fica_reviewed_at: new Date().toISOString(),
          fica_rejection_reason: null
        })
        .eq('user_id', user_id)

      if (error) throw error

      // Log the action
      await supabase.from('fica_audit_log').insert({
        user_id: user_id,
        action: 'approved',
        performed_by: user.id
      })
    } else if (action === 'reject_fica') {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          fica_status: 'rejected',
          fica_rejection_reason: updateData.rejection_reason,
          fica_reviewed_by: user.id,
          fica_reviewed_at: new Date().toISOString()
        })
        .eq('user_id', user_id)

      if (error) throw error

      // Log the action
      await supabase.from('fica_audit_log').insert({
        user_id: user_id,
        action: 'rejected',
        performed_by: user.id,
        reason: updateData.rejection_reason
      })
    } else {
      // Generic update
      const { error } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('user_id', user_id)

      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

