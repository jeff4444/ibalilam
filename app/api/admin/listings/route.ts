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
    const status = searchParams.get('status') || ''
    const category = searchParams.get('category') || ''
    const flagged = searchParams.get('flagged') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('parts')
      .select(`
        *,
        shops!parts_shop_id_fkey (
          name,
          user_id
        )
      `, { count: 'exact' })

    // Apply search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    // Apply status filter
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    // Apply category filter
    if (category && category !== 'all') {
      query = query.eq('category', category)
    }

    // Apply flagged filter
    if (flagged === 'true') {
      query = query.eq('is_flagged', true)
    }

    // Apply pagination and ordering
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) throw error

    // Transform data
    const listings = data?.map(part => ({
      id: part.id,
      shop_id: part.shop_id,
      name: part.name,
      description: part.description,
      category: part.category,
      price: parseFloat(part.price) || 0,
      stock_quantity: part.stock_quantity,
      status: part.status,
      part_type: part.part_type,
      views: part.views,
      image_url: part.image_url,
      images: part.images,
      is_flagged: part.is_flagged,
      flag_reason: part.flag_reason,
      flag_count: part.flag_count,
      created_at: part.created_at,
      updated_at: part.updated_at,
      shop_name: part.shops?.name || 'Unknown Shop'
    })) || []

    return NextResponse.json({
      listings,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching listings:', error)
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
    const { listing_id, action, ...updateData } = body

    if (!listing_id) {
      return NextResponse.json({ error: 'listing_id is required' }, { status: 400 })
    }

    if (action === 'approve') {
      const { error } = await supabase
        .from('parts')
        .update({ status: 'active', published_at: new Date().toISOString() })
        .eq('id', listing_id)

      if (error) throw error
    } else if (action === 'suspend') {
      const { error } = await supabase
        .from('parts')
        .update({ status: 'inactive', admin_notes: updateData.reason })
        .eq('id', listing_id)

      if (error) throw error
    } else if (action === 'clear_flag') {
      const { error } = await supabase
        .from('parts')
        .update({ is_flagged: false, flag_reason: null, flag_count: 0 })
        .eq('id', listing_id)

      if (error) throw error

      // Also update related part_flags
      await supabase
        .from('part_flags')
        .update({ status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: user.id })
        .eq('part_id', listing_id)
        .eq('status', 'pending')
    } else {
      const { error } = await supabase
        .from('parts')
        .update(updateData)
        .eq('id', listing_id)

      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating listing:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

