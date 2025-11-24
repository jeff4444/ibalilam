import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(cookies())
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch user's orders with order items and part details
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select(`
        id,
        order_number,
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
            category
          )
        )
      `)
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false })

    if (ordersError) {
      console.error("Error fetching orders:", ordersError)
      return NextResponse.json(
        { error: "Failed to fetch orders" },
        { status: 500 }
      )
    }

    return NextResponse.json({ orders: orders || [] })
  } catch (error) {
    console.error("Error in GET /api/orders:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

