import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { cookies } from "next/headers"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params
    const supabase = await createClient(cookies())
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch order with verification that user owns it (customer_id check)
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        id,
        order_number,
        shop_id,
        customer_id,
        status,
        payment_status,
        total_amount,
        subtotal,
        tax_amount,
        shipping_amount,
        discount_amount,
        shipping_address,
        billing_address,
        payment_method,
        customer_notes,
        tracking_number,
        carrier,
        tracking_url,
        created_at,
        updated_at,
        shipped_at,
        delivered_at,
        order_items (
          id,
          part_id,
          quantity,
          unit_price,
          total_price,
          parts (
            id,
            name,
            image_url,
            images,
            category,
            shop_id
          )
        ),
        shops (
          id,
          name,
          user_id
        )
      `)
      .eq("id", orderId)
      .eq("customer_id", user.id)
      .single()

    if (orderError) {
      if (orderError.code === "PGRST116") {
        return NextResponse.json({ error: "Order not found" }, { status: 404 })
      }
      console.error("Error fetching order:", orderError)
      return NextResponse.json(
        { error: "Failed to fetch order" },
        { status: 500 }
      )
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    return NextResponse.json({ order })
  } catch (error) {
    console.error("Error in GET /api/orders/[orderId]:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params
    const supabase = await createClient(cookies())
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { action } = body

    if (action !== "cancel") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    // Fetch order to verify ownership and status
    const { data: existingOrder, error: orderError } = await supabase
      .from("orders")
      .select("id, customer_id, status, payment_status")
      .eq("id", orderId)
      .eq("customer_id", user.id)
      .single()

    if (orderError || !existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // Only allow cancellation if order is pending and payment is pending
    if (existingOrder.status !== "pending" || existingOrder.payment_status !== "pending") {
      return NextResponse.json(
        { error: "Only pending orders with pending payment can be cancelled" },
        { status: 400 }
      )
    }

    // Update order status to cancelled (include customer_id for RLS)
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId)
      .eq("customer_id", user.id)

    if (updateError) {
      console.error("Error cancelling order:", updateError)
      return NextResponse.json(
        { error: "Failed to cancel order" },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      message: "Order cancelled successfully",
      order: { ...existingOrder, status: "cancelled" }
    })
  } catch (error) {
    console.error("Error in PATCH /api/orders/[orderId]:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params
    const supabase = await createClient(cookies())
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log(orderId, user.id)

    // Fetch order to verify ownership and status
    const { data: existingOrder, error: orderError } = await supabase
      .from("orders")
      .select("id, customer_id, status, payment_status")
      .eq("id", orderId)
      .eq("customer_id", user.id)
      .single()

    if (orderError || !existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // Only allow deletion if order is pending and payment is pending
    if (existingOrder.status !== "pending" || existingOrder.payment_status !== "pending") {
      return NextResponse.json(
        { error: "Only pending orders with pending payment can be deleted" },
        { status: 400 }
      )
    }

    // Delete order items first
    const { error: deleteItemsError } = await supabase
      .from("order_items")
      .delete()
      .eq("order_id", orderId)

    if (deleteItemsError) {
      console.error("Error deleting order items:", deleteItemsError)
      return NextResponse.json(
        { error: "Failed to delete order items" },
        { status: 500 }
      )
    }

    // Delete the order
    const { error: deleteOrderError } = await supabase
      .from("orders")
      .delete()
      .eq("id", orderId)
      .eq("customer_id", user.id)

    if (deleteOrderError) {
      console.error("Error deleting order:", deleteOrderError)
      return NextResponse.json(
        { error: "Failed to delete order" },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      message: "Order deleted successfully"
    })
  } catch (error) {
    console.error("Error in DELETE /api/orders/[orderId]:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

