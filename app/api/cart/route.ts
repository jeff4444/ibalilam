import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { withRateLimit } from '@/lib/rate-limit-middleware'

// GET - Fetch user's cart items
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(cookies())
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // MED-001 FIX: Add rate limiting
    const rateLimitResponse = await withRateLimit(request, 'api_general', user.id)
    if (rateLimitResponse) return rateLimitResponse

    // Fetch cart items with part details
    const { data: cartItems, error } = await supabase
      .from('cart_items')
      .select(`
        id,
        part_id,
        quantity,
        tier_price,
        tier_name,
        parts!inner(
          id,
          name,
          price,
          image_url,
          stock_quantity,
          moq_units,
          order_increment,
          pack_size_units,
          stock_on_hand_units,
          backorder_allowed,
          lead_time_days,
          part_type,
          shops!inner(
            name
          )
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching cart items:', error)
      return NextResponse.json({ error: 'Failed to fetch cart items' }, { status: 500 })
    }

    // Transform cart items to match CartItem interface
    const transformedItems = (cartItems || []).map((item: any) => ({
      id: item.part_id, // Use part_id as the cart item ID
      name: item.parts.name,
      price: item.parts.price,
      quantity: item.quantity,
      image: item.parts.image_url || '/placeholder.svg',
      seller: item.parts.shops.name,
      condition: item.parts.part_type || 'original',
      stock: item.parts.stock_quantity || 0,
      moqUnits: item.parts.moq_units || 1,
      orderIncrement: item.parts.order_increment || 1,
      packSizeUnits: item.parts.pack_size_units,
      stockOnHand: item.parts.stock_on_hand_units || 0,
      backorderAllowed: item.parts.backorder_allowed || false,
      leadTimeDays: item.parts.lead_time_days,
      tierPrice: item.tier_price || item.parts.price,
      tierName: item.tier_name || 'Base Price',
    }))

    return NextResponse.json({ items: transformedItems })
  } catch (error) {
    console.error('Error in GET /api/cart:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Add or update cart item
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient(cookies())
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // MED-001 FIX: Add rate limiting
    const rateLimitResponse = await withRateLimit(request, 'api_general', user.id)
    if (rateLimitResponse) return rateLimitResponse

    const body = await request.json()
    const { partId, quantity, tierPrice, tierName } = body

    if (!partId || !quantity || quantity <= 0) {
      return NextResponse.json(
        { error: 'Missing required fields: partId and quantity' },
        { status: 400 }
      )
    }

    // Check if part exists and is active
    const { data: part, error: partError } = await supabase
      .from('parts')
      .select('id, stock_quantity, status')
      .eq('id', partId)
      .eq('status', 'active')
      .single()

    if (partError || !part) {
      return NextResponse.json(
        { error: 'Part not found or not available' },
        { status: 404 }
      )
    }

    // Check if cart item already exists
    const { data: existingItem } = await supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('user_id', user.id)
      .eq('part_id', partId)
      .single()

    if (existingItem) {
      // Update existing item
      const newQuantity = existingItem.quantity + quantity
      const { error: updateError } = await supabase
        .from('cart_items')
        .update({
          quantity: newQuantity,
          tier_price: tierPrice || null,
          tier_name: tierName || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingItem.id)

      if (updateError) {
        console.error('Error updating cart item:', updateError)
        return NextResponse.json({ error: 'Failed to update cart item' }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: 'Cart item updated' })
    } else {
      // Insert new item
      const { error: insertError } = await supabase
        .from('cart_items')
        .insert({
          user_id: user.id,
          part_id: partId,
          quantity,
          tier_price: tierPrice || null,
          tier_name: tierName || null,
        })

      if (insertError) {
        console.error('Error inserting cart item:', insertError)
        return NextResponse.json({ error: 'Failed to add cart item' }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: 'Cart item added' })
    }
  } catch (error) {
    console.error('Error in POST /api/cart:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update cart item quantity
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient(cookies())
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // MED-001 FIX: Add rate limiting
    const rateLimitResponse = await withRateLimit(request, 'api_general', user.id)
    if (rateLimitResponse) return rateLimitResponse

    const body = await request.json()
    const { partId, quantity, tierPrice, tierName } = body

    if (!partId || quantity === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: partId and quantity' },
        { status: 400 }
      )
    }

    if (quantity <= 0) {
      // Delete the item if quantity is 0 or less
      const { error: deleteError } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', user.id)
        .eq('part_id', partId)

      if (deleteError) {
        console.error('Error deleting cart item:', deleteError)
        return NextResponse.json({ error: 'Failed to remove cart item' }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: 'Cart item removed' })
    }

    // Update cart item
    const { error: updateError } = await supabase
      .from('cart_items')
      .update({
        quantity,
        tier_price: tierPrice || null,
        tier_name: tierName || null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('part_id', partId)

    if (updateError) {
      console.error('Error updating cart item:', updateError)
      return NextResponse.json({ error: 'Failed to update cart item' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Cart item updated' })
  } catch (error) {
    console.error('Error in PUT /api/cart:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Remove cart item
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient(cookies())
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // MED-001 FIX: Add rate limiting
    const rateLimitResponse = await withRateLimit(request, 'api_general', user.id)
    if (rateLimitResponse) return rateLimitResponse

    const { searchParams } = new URL(request.url)
    const partId = searchParams.get('partId')

    if (!partId) {
      return NextResponse.json(
        { error: 'Missing required parameter: partId' },
        { status: 400 }
      )
    }

    const { error: deleteError } = await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', user.id)
      .eq('part_id', partId)

    if (deleteError) {
      console.error('Error deleting cart item:', deleteError)
      return NextResponse.json({ error: 'Failed to remove cart item' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Cart item removed' })
  } catch (error) {
    console.error('Error in DELETE /api/cart:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

