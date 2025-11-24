import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { cookies } from "next/headers"

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient(cookies())
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const {
      items, // Array of cart items with part_id, quantity, tierPrice
      shippingAddress,
      customerEmail,
      customerName,
      subtotal,
      shippingAmount,
      taxAmount,
      discountAmount,
      totalAmount,
    } = body

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Cart items are required" },
        { status: 400 }
      )
    }

    if (!shippingAddress || !customerEmail || !totalAmount) {
      return NextResponse.json(
        { error: "Missing required fields: shippingAddress, customerEmail, totalAmount" },
        { status: 400 }
      )
    }

    // Fetch parts to get shop_id and category for each item
    const partIds = items.map((item: any) => item.part_id || item.id)
    const { data: parts, error: partsError } = await supabase
      .from("parts")
      .select("id, shop_id, category, price")
      .in("id", partIds)

    if (partsError || !parts || parts.length !== partIds.length) {
      console.error("Error fetching parts:", partsError)
      return NextResponse.json(
        { error: "Failed to fetch part information" },
        { status: 500 }
      )
    }

    // Create a map of part_id to part data
    const partsMap = new Map(parts.map((p) => [p.id, p]))

    // Determine primary shop_id (use first item's shop_id)
    const primaryShopId = parts[0]?.shop_id
    if (!primaryShopId) {
      return NextResponse.json(
        { error: "Unable to determine shop for order" },
        { status: 400 }
      )
    }

    // Create order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        shop_id: primaryShopId,
        customer_id: user.id,
        customer_email: customerEmail,
        customer_name: customerName || `${shippingAddress.firstName || ""} ${shippingAddress.lastName || ""}`.trim(),
        status: "pending",
        payment_status: "pending",
        payment_method: "payfast",
        total_amount: parseFloat(totalAmount),
        subtotal: parseFloat(subtotal || totalAmount),
        tax_amount: parseFloat(taxAmount || "0"),
        shipping_amount: parseFloat(shippingAmount || "0"),
        discount_amount: parseFloat(discountAmount || "0"),
        shipping_address: {
          firstName: shippingAddress.firstName,
          lastName: shippingAddress.lastName,
          address: shippingAddress.address,
          city: shippingAddress.city,
          state: shippingAddress.state,
          zipCode: shippingAddress.zipCode,
          country: shippingAddress.country || "ZA",
        },
        billing_address: {
          firstName: shippingAddress.firstName,
          lastName: shippingAddress.lastName,
          address: shippingAddress.address,
          city: shippingAddress.city,
          state: shippingAddress.state,
          zipCode: shippingAddress.zipCode,
          country: shippingAddress.country || "ZA",
        },
      })
      .select()
      .single()

    if (orderError || !order) {
      console.error("Error creating order:", orderError)
      return NextResponse.json(
        { error: "Failed to create order" },
        { status: 500 }
      )
    }

    // Create order items
    const orderItems = items.map((item: any) => {
      const part = partsMap.get(item.part_id || item.id)
      if (!part) {
        throw new Error(`Part not found: ${item.part_id || item.id}`)
      }

      const unitPrice = item.tierPrice || item.price || part.price
      const quantity = item.quantity

      return {
        order_id: order.id,
        part_id: part.id,
        quantity: quantity,
        unit_price: parseFloat(unitPrice.toString()),
        total_price: parseFloat((unitPrice * quantity).toString()),
      }
    })

    const { error: orderItemsError } = await supabase
      .from("order_items")
      .insert(orderItems)

    if (orderItemsError) {
      console.error("Error creating order items:", orderItemsError)
      // Try to delete the order if order items creation fails
      await supabase.from("orders").delete().eq("id", order.id)
      return NextResponse.json(
        { error: "Failed to create order items" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      orderId: order.id,
      orderNumber: order.order_number,
    })
  } catch (error) {
    console.error("Error in order creation:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

