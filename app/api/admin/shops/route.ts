import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = await createClient(cookieStore, true)
    
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
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Build query - fetch shops first
    let query = supabase
      .from('shops')
      .select('*', { count: 'exact' })

    // Apply search filter
    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    // Apply status filter
    if (status && status !== 'all') {
      query = query.eq('is_active', status === 'active')
    }

    // Apply pagination and ordering
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: shopsData, error, count } = await query

    if (error) throw error

    // Fetch user profiles for all shop owners
    const userIds = shopsData?.map(shop => shop.user_id) || []
    let ownerProfiles: Record<string, any> = {}
    
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id, full_name, first_name, last_name, fica_status')
        .in('user_id', userIds)
      
      if (profiles) {
        profiles.forEach(profile => {
          ownerProfiles[profile.user_id] = profile
        })
      }
    }

    // Transform data
    const shops = shopsData?.map(shop => {
      const owner = ownerProfiles[shop.user_id]
      return {
        id: shop.id,
        user_id: shop.user_id,
        name: shop.name,
        description: shop.description,
        rating: shop.rating,
        review_count: shop.review_count,
        total_sales: shop.total_sales,
        total_views: shop.total_views,
        active_listings: shop.active_listings,
        is_active: shop.is_active,
        locked_balance: parseFloat(shop.locked_balance) || 0,
        available_balance: parseFloat(shop.available_balance) || 0,
        created_at: shop.created_at,
        updated_at: shop.updated_at,
        owner_name: owner?.full_name || 
          `${owner?.first_name || ''} ${owner?.last_name || ''}`.trim() || 
          'Unknown',
        owner_fica_status: owner?.fica_status
      }
    }) || []

    return NextResponse.json({
      shops,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching shops:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = await createClient(cookieStore, true)
    
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
    const { shop_id, action, ...updateData } = body

    if (!shop_id) {
      return NextResponse.json({ error: 'shop_id is required' }, { status: 400 })
    }

    if (action === 'activate') {
      const { error } = await supabase
        .from('shops')
        .update({ is_active: true })
        .eq('id', shop_id)

      if (error) throw error
    } else if (action === 'deactivate') {
      const { error } = await supabase
        .from('shops')
        .update({ is_active: false })
        .eq('id', shop_id)

      if (error) throw error
    } else {
      const { error } = await supabase
        .from('shops')
        .update(updateData)
        .eq('id', shop_id)

      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating shop:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

