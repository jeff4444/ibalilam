import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { cookies } from "next/headers"
import { sanitizeSearchInput } from "@/lib/utils"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(cookies())
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user's shop
    const { data: shop, error: shopError } = await supabase
      .from("shops")
      .select("id")
      .eq("user_id", user.id)
      .single()

    if (shopError || !shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 })
    }

    // Parse query parameters for filters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const paymentStatus = searchParams.get("payment_status")
    const startDate = searchParams.get("start_date")
    const endDate = searchParams.get("end_date")
    const search = searchParams.get("search")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")

    // Build the query
    let query = supabase
      .from("orders")
      .select(`
        id,
        order_number,
        customer_id,
        customer_email,
        customer_name,
        customer_phone,
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
        internal_notes,
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
            category
          )
        ),
        transactions (
          id,
          amount,
          commission_amount,
          seller_amount,
          status,
          escrow_status
        )
      `, { count: "exact" })
      .eq("shop_id", shop.id)
      .order("created_at", { ascending: false })

    // Apply filters - exclude pending orders from seller view by default
    if (status && status !== "all") {
      query = query.eq("status", status)
    } else {
      // Don't show pending orders to sellers - they should only see confirmed+ orders
      query = query.neq("status", "pending")
    }

    if (paymentStatus && paymentStatus !== "all") {
      query = query.eq("payment_status", paymentStatus)
    }

    if (startDate) {
      query = query.gte("created_at", startDate)
    }

    if (endDate) {
      query = query.lte("created_at", endDate)
    }

    // SECURITY FIX: VULN-010 - Sanitize search input to prevent SQL injection
    const sanitizedSearch = sanitizeSearchInput(search)
    if (sanitizedSearch) {
      query = query.or(`order_number.ilike.%${sanitizedSearch}%,customer_name.ilike.%${sanitizedSearch}%,customer_email.ilike.%${sanitizedSearch}%`)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: orders, error: ordersError, count } = await query

    if (ordersError) {
      console.error("Error fetching seller orders:", ordersError)
      return NextResponse.json(
        { error: "Failed to fetch orders" },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      orders: orders || [],
      total: count || 0,
      limit,
      offset
    })
  } catch (error) {
    console.error("Error in GET /api/seller/orders:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

