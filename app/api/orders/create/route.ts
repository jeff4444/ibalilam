import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { cookies } from "next/headers"
import { auditLog } from "@/lib/audit-logger"
import { withRateLimit } from "@/lib/rate-limit-middleware"

// Server-side shipping cost calculation
function calculateShippingCost(subtotal: number, shippingMethod: string): number {
  if (shippingMethod === "express") return 19.99
  return subtotal > 50 ? 0 : 9.99
}

interface OrderItem {
  part_id: string
  quantity: number
}

interface TierPriceResult {
  unit_price: number
  total_price: number
  tier_name: string
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient(cookies())
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // INFO-001 FIX: Rate limit order creation
    const rateLimitResponse = await withRateLimit(req, 'order_create', user.id)
    if (rateLimitResponse) return rateLimitResponse

    const body = await req.json()
    const {
      items, // Array of cart items with part_id and quantity ONLY - prices are calculated server-side
      shippingAddress,
      customerEmail,
      customerName,
      shippingMethod, // "standard" or "express"
    } = body

    // Validate required fields - NOTE: We no longer accept pricing fields from client
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Cart items are required" },
        { status: 400 }
      )
    }

    if (!shippingAddress || !customerEmail) {
      return NextResponse.json(
        { error: "Missing required fields: shippingAddress, customerEmail" },
        { status: 400 }
      )
    }

    // Validate each item has required fields
    for (const item of items) {
      const partId = item.part_id || item.id
      if (!partId || typeof item.quantity !== "number" || item.quantity < 1) {
        return NextResponse.json(
          { error: "Each item must have a valid part_id and quantity" },
          { status: 400 }
        )
      }
    }

    // Fetch parts with all necessary pricing and stock information from database
    const partIds = items.map((item: OrderItem) => item.part_id || (item as any).id)
    const { data: parts, error: partsError } = await supabase
      .from("parts")
      .select("id, shop_id, category, price, name, stock_quantity, moq_units, order_increment, pack_size_units")
      .in("id", partIds)

    if (partsError || !parts) {
      console.error("Error fetching parts:", partsError)
      return NextResponse.json(
        { error: "Failed to fetch part information" },
        { status: 500 }
      )
    }

    // Verify all requested parts exist
    if (parts.length !== partIds.length) {
      const foundIds = new Set(parts.map(p => p.id))
      const missingIds = partIds.filter((id: string) => !foundIds.has(id))
      return NextResponse.json(
        { error: `Parts not found: ${missingIds.join(", ")}` },
        { status: 400 }
      )
    }

    // Create a map of part_id to part data
    const partsMap = new Map(parts.map((p) => [p.id, p]))

    // Validate MOQ, pack size, order increment, and stock availability
    for (const item of items) {
      const partId = item.part_id || item.id
      const part = partsMap.get(partId)
      if (!part) continue

      // Validate stock availability
      if (part.stock_quantity < item.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for "${part.name}": requested ${item.quantity}, available ${part.stock_quantity}` },
          { status: 400 }
        )
      }

      // Validate MOQ requirements
      const moqUnits = part.moq_units || 1
      if (item.quantity < moqUnits) {
        return NextResponse.json(
          { error: `Minimum order quantity for "${part.name}" is ${moqUnits} units` },
          { status: 400 }
        )
      }

      // Validate pack size if applicable
      if (part.pack_size_units && item.quantity % part.pack_size_units !== 0) {
        return NextResponse.json(
          { error: `"${part.name}" must be ordered in packs of ${part.pack_size_units}` },
          { status: 400 }
        )
      }

      // Validate order increment if no pack size
      if (!part.pack_size_units && part.order_increment && part.order_increment > 1) {
        if (item.quantity % part.order_increment !== 0) {
          return NextResponse.json(
            { error: `"${part.name}" must be ordered in increments of ${part.order_increment}` },
            { status: 400 }
          )
        }
      }
    }

    // Calculate prices server-side using the database get_tier_price function
    let calculatedSubtotal = 0
    const orderItemsData: Array<{
      part_id: string
      quantity: number
      unit_price: number
      total_price: number
      tier_name?: string
    }> = []

    for (const item of items) {
      const partId = item.part_id || item.id
      const part = partsMap.get(partId)
      if (!part) {
        return NextResponse.json(
          { error: `Part not found: ${partId}` },
          { status: 400 }
        )
      }

      // Use the database function to get tier pricing
      const { data: tierPriceData, error: tierError } = await supabase.rpc("get_tier_price", {
        part_id_param: partId,
        quantity: item.quantity,
      })

      let unitPrice: number
      let tierName: string | undefined

      if (tierError || !tierPriceData || tierPriceData.length === 0) {
        // Fallback to base price from parts table if tier pricing fails
        console.warn(`Tier pricing failed for part ${partId}, using base price:`, tierError)
        unitPrice = parseFloat(part.price.toString())
        tierName = "Base Price"
      } else {
        const tierResult = tierPriceData[0] as TierPriceResult
        unitPrice = parseFloat(tierResult.unit_price.toString())
        tierName = tierResult.tier_name
      }

      const itemTotal = unitPrice * item.quantity
      calculatedSubtotal += itemTotal

      orderItemsData.push({
        part_id: partId,
        quantity: item.quantity,
        unit_price: unitPrice,
        total_price: itemTotal,
        tier_name: tierName,
      })
    }

    // Calculate shipping cost server-side
    const calculatedShippingAmount = calculateShippingCost(calculatedSubtotal, shippingMethod || "standard")
    
    // Tax calculation (can be expanded based on business rules)
    const calculatedTaxAmount = 0 // Currently no tax, but can be calculated here
    
    // Discount calculation (can be expanded for promo codes, etc.)
    const calculatedDiscountAmount = 0
    
    // Calculate final total
    const calculatedTotalAmount = calculatedSubtotal + calculatedShippingAmount + calculatedTaxAmount - calculatedDiscountAmount

    // Maximum order amount - prevent overflow (VULN-008 fix)
    // Max single order: R100 billion (well below DECIMAL(18,2) limit)
    const MAX_ORDER_AMOUNT = 100000000000 // R100 billion
    if (calculatedTotalAmount > MAX_ORDER_AMOUNT) {
      return NextResponse.json(
        { error: `Order total exceeds maximum allowed amount of R${MAX_ORDER_AMOUNT.toLocaleString()}` },
        { status: 400 }
      )
    }

    // Determine primary shop_id (use first item's shop_id)
    const primaryShopId = parts[0]?.shop_id
    if (!primaryShopId) {
      return NextResponse.json(
        { error: "Unable to determine shop for order" },
        { status: 400 }
      )
    }

    // Create order with SERVER-CALCULATED prices (not client-provided)
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
        total_amount: calculatedTotalAmount,
        subtotal: calculatedSubtotal,
        tax_amount: calculatedTaxAmount,
        shipping_amount: calculatedShippingAmount,
        discount_amount: calculatedDiscountAmount,
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

    // Create order items with server-calculated prices
    const orderItems = orderItemsData.map((itemData) => ({
      order_id: order.id,
      part_id: itemData.part_id,
      quantity: itemData.quantity,
      unit_price: itemData.unit_price,
      total_price: itemData.total_price,
    }))

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

    // ============================================================
    // STOCK DEDUCTION
    // ============================================================
    // Deduct stock after order creation
    // Note: For production, consider implementing atomic stock reservation
    // with pessimistic locking to prevent race conditions
    
    for (const item of items) {
      const partId = item.part_id || (item as any).id
      const part = partsMap.get(partId)
      if (!part) continue

      const { error: stockError } = await supabase
        .from("parts")
        .update({ stock_quantity: part.stock_quantity - item.quantity })
        .eq("id", partId)

      if (stockError) {
        console.error(`Error updating stock for part ${partId}:`, stockError)
        // Note: In a production system, you'd want to rollback the order here
        // For now, we log the error but continue
      }
    }

    // INFO-004 FIX: Log successful order creation
    await auditLog.order.create(user.id, order.id, calculatedTotalAmount, req)

    // Return order details including server-calculated totals
    // This allows the client to display the correct amounts
    return NextResponse.json({
      orderId: order.id,
      orderNumber: order.order_number,
      // Return calculated totals so client can verify/display
      calculatedTotals: {
        subtotal: calculatedSubtotal,
        shippingAmount: calculatedShippingAmount,
        taxAmount: calculatedTaxAmount,
        discountAmount: calculatedDiscountAmount,
        totalAmount: calculatedTotalAmount,
      }
    })
  } catch (error) {
    console.error("Error in order creation:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
