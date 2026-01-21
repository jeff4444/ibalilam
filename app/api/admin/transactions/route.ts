import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { supabaseAdmin } from '@/utils/supabase/admin'
import { sanitizeSearchInput } from '@/lib/utils'
import { verifyAdmin } from '@/lib/auth-utils'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    // Get user from request cookies (authenticated session)
    const supabase = await createClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin status from admins table using admin client
    const adminInfo = await verifyAdmin(supabaseAdmin, user.id)
    if (!adminInfo.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const escrowStatus = searchParams.get('escrow_status') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Build query using admin client
    let query = supabaseAdmin
      .from('transactions')
      .select(`
        *,
        orders!transactions_order_id_fkey (
          order_number,
          customer_name,
          customer_email,
          shops!orders_shop_id_fkey (
            name
          )
        )
      `, { count: 'exact' })

    // Apply search filter (search by order number or payment intent)
    // SECURITY FIX: VULN-010 - Sanitize search input to prevent SQL injection
    const sanitizedSearch = sanitizeSearchInput(search)
    if (sanitizedSearch) {
      // First get order IDs that match the search
      const { data: matchingOrders } = await supabaseAdmin
        .from('orders')
        .select('id')
        .or(`order_number.ilike.%${sanitizedSearch}%,customer_name.ilike.%${sanitizedSearch}%,customer_email.ilike.%${sanitizedSearch}%`)

      const orderIds = matchingOrders?.map(o => o.id) || []
      
      if (orderIds.length > 0) {
        query = query.or(`payment_intent_id.ilike.%${sanitizedSearch}%,order_id.in.(${orderIds.join(',')})`)
      } else {
        query = query.ilike('payment_intent_id', `%${sanitizedSearch}%`)
      }
    }

    // Apply status filter
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    // Apply escrow status filter
    if (escrowStatus && escrowStatus !== 'all') {
      query = query.eq('escrow_status', escrowStatus)
    }

    // Apply pagination and ordering
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) throw error

    // Transform data
    const transactions = data?.map(tx => ({
      id: tx.id,
      order_id: tx.order_id,
      amount: parseFloat(tx.amount) || 0,
      commission_amount: parseFloat(tx.commission_amount) || 0,
      seller_amount: parseFloat(tx.seller_amount) || 0,
      status: tx.status,
      payment_method: tx.payment_method,
      payment_intent_id: tx.payment_intent_id,
      escrow_status: tx.escrow_status,
      escrow_hold_until: tx.escrow_hold_until,
      created_at: tx.created_at,
      updated_at: tx.updated_at,
      completed_at: tx.completed_at,
      refunded_at: tx.refunded_at,
      refund_reason: tx.refund_reason,
      dispute_reason: tx.dispute_reason,
      admin_notes: tx.admin_notes,
      order_number: tx.orders?.order_number,
      customer_name: tx.orders?.customer_name,
      customer_email: tx.orders?.customer_email,
      shop_name: tx.orders?.shops?.name || 'Unknown Shop'
    })) || []

    return NextResponse.json({
      transactions,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Get user from request cookies (authenticated session)
    const supabase = await createClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin status from admins table using admin client
    const adminInfo = await verifyAdmin(supabaseAdmin, user.id)
    if (!adminInfo.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { transaction_id, action, ...updateData } = body

    if (!transaction_id) {
      return NextResponse.json({ error: 'transaction_id is required' }, { status: 400 })
    }

    if (action === 'release_escrow') {
      const { error } = await supabaseAdmin
        .from('transactions')
        .update({ 
          escrow_status: 'released',
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', transaction_id)

      if (error) throw error

      // Also release the funds to the seller
      const { data: tx } = await supabaseAdmin
        .from('transactions')
        .select('order_id, seller_amount')
        .eq('id', transaction_id)
        .single()

      if (tx) {
        const { data: order } = await supabaseAdmin
          .from('orders')
          .select('shop_id')
          .eq('id', tx.order_id)
          .single()

        if (order) {
          await supabaseAdmin.rpc('release_escrow_funds', {
            p_shop_id: order.shop_id,
            p_amount: tx.seller_amount
          })
        }
      }
    } else if (action === 'refund') {
      const { error } = await supabaseAdmin
        .from('transactions')
        .update({ 
          status: 'refunded',
          escrow_status: 'refunded',
          refunded_at: new Date().toISOString(),
          refund_reason: updateData.reason
        })
        .eq('id', transaction_id)

      if (error) throw error
    } else if (action === 'dispute') {
      const { error } = await supabaseAdmin
        .from('transactions')
        .update({ 
          status: 'disputed',
          escrow_status: 'disputed',
          dispute_reason: updateData.reason
        })
        .eq('id', transaction_id)

      if (error) throw error
    } else {
      const { error } = await supabaseAdmin
        .from('transactions')
        .update(updateData)
        .eq('id', transaction_id)

      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating transaction:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
