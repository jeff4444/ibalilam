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
    const paymentStatus = searchParams.get('payment_status') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('orders')
      .select(`
        *,
        shops!orders_shop_id_fkey (
          name
        ),
        order_items (
          id,
          quantity,
          unit_price,
          total_price,
          parts!order_items_part_id_fkey (
            name
          )
        )
      `, { count: 'exact' })

    // Apply search filter
    if (search) {
      query = query.or(`order_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_email.ilike.%${search}%`)
    }

    // Apply status filter
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    // Apply payment status filter
    if (paymentStatus && paymentStatus !== 'all') {
      query = query.eq('payment_status', paymentStatus)
    }

    // Apply pagination and ordering
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) throw error

    // Transform data
    const orders = data?.map(order => ({
      id: order.id,
      order_number: order.order_number,
      shop_id: order.shop_id,
      customer_id: order.customer_id,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      customer_phone: order.customer_phone,
      status: order.status,
      payment_status: order.payment_status,
      payment_method: order.payment_method,
      total_amount: parseFloat(order.total_amount) || 0,
      subtotal: parseFloat(order.subtotal) || 0,
      tax_amount: parseFloat(order.tax_amount) || 0,
      shipping_amount: parseFloat(order.shipping_amount) || 0,
      discount_amount: parseFloat(order.discount_amount) || 0,
      shipping_address: order.shipping_address,
      created_at: order.created_at,
      updated_at: order.updated_at,
      shipped_at: order.shipped_at,
      delivered_at: order.delivered_at,
      shop_name: order.shops?.name || 'Unknown Shop',
      items: order.order_items?.map((item: any) => ({
        id: item.id,
        quantity: item.quantity,
        unit_price: parseFloat(item.unit_price) || 0,
        total_price: parseFloat(item.total_price) || 0,
        part_name: item.parts?.name || 'Unknown Part'
      })) || []
    })) || []

    return NextResponse.json({
      orders,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching orders:', error)
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
    const { order_id, action, ...updateData } = body

    if (!order_id) {
      return NextResponse.json({ error: 'order_id is required' }, { status: 400 })
    }

    if (action === 'update_status') {
      const statusUpdate: any = { status: updateData.status }
      
      if (updateData.status === 'shipped') {
        statusUpdate.shipped_at = new Date().toISOString()
      } else if (updateData.status === 'delivered') {
        statusUpdate.delivered_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('orders')
        .update(statusUpdate)
        .eq('id', order_id)

      if (error) throw error
    } else if (action === 'update_payment') {
      const { error } = await supabase
        .from('orders')
        .update({ payment_status: updateData.payment_status })
        .eq('id', order_id)

      if (error) throw error
    } else {
      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', order_id)

      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

