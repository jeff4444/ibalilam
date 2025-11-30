import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { createClient } from "@/utils/supabase/server"
import { cookies } from "next/headers"

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const data: Record<string, string> = {}

    // Convert FormData to object
    formData.forEach((value, key) => {
      data[key] = value.toString()
    })

    console.log("PayFast IPN received")

    // Validate signature
    const signature = data.signature
    delete data.signature

    const passphrase = process.env.PAYFAST_PASSPHRASE
    const generatedSignature = generateSignature(data, passphrase)

    if (signature !== generatedSignature) {
      console.error("PayFast IPN: Invalid signature", signature, generatedSignature)
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }

    // Verify payment status
    const paymentStatus = data.payment_status
    const merchantId = data.merchant_id
    const amount = data.amount_gross
    const itemName = data.item_name
    const orderId = data.custom_str1 // Extract order ID from custom field
    const paymentId = data.pf_payment_id || data.m_payment_id // PayFast payment ID

    // Verify merchant_id matches
    if (merchantId !== process.env.MERCHANT_ID) {
      console.error("PayFast IPN: Invalid merchant ID")
      return NextResponse.json({ error: "Invalid merchant ID" }, { status: 400 })
    }

    // Initialize Supabase client
    const supabase = await createClient(cookies(), true)

    // Process the payment based on status
    switch (paymentStatus) {
      case "COMPLETE":
        
        if (!orderId) {
          console.error("PayFast IPN: No order ID provided")
          return NextResponse.json({ error: "Order ID missing" }, { status: 400 })
        }

        // Check if order exists
        const { data: existingOrder, error: fetchError } = await supabase
          .from("orders")
          .select("id")
          .eq("id", orderId)
          .single()

        if (fetchError || !existingOrder) {
          console.error("PayFast IPN: Order not found", orderId, fetchError)
          return NextResponse.json({ error: "Order not found" }, { status: 404 })
        }

        // Update order payment status
        const { data: updatedOrder, error: updateError } = await supabase
          .from("orders")
          .update({
            payment_status: "paid",
            status: "confirmed",
            payment_intent_id: paymentId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId)
          .select()
          .single()

        if (updateError) {
          console.error("Error updating order:", updateError)
          return NextResponse.json({ error: "Failed to update order" }, { status: 500 })
        }

        if (!updatedOrder) {
          console.error("PayFast IPN: Order update did not affect any rows", orderId)
          return NextResponse.json({ error: "Order update failed" }, { status: 500 })
        }

        // Get order items with part and shop information
        const { data: orderItems, error: orderItemsError } = await supabase
          .from("order_items")
          .select(`
            id,
            part_id,
            quantity,
            unit_price,
            total_price,
            parts!inner(
              id,
              shop_id,
              category
            )
          `)
          .eq("order_id", orderId)

        if (orderItemsError || !orderItems) {
          console.error("Error fetching order items:", orderItemsError)
          return NextResponse.json({ error: "Failed to fetch order items" }, { status: 500 })
        }

        // Group order items by shop_id
        const shopItemsMap = new Map<string, typeof orderItems>()
        orderItems.forEach((item: any) => {
          const shopId = item.parts.shop_id
          if (!shopItemsMap.has(shopId)) {
            shopItemsMap.set(shopId, [])
          }
          shopItemsMap.get(shopId)!.push(item)
        })

        // Get commission percentages for categories
        const categories = Array.from(new Set(orderItems.map((item: any) => item.parts?.category).filter(Boolean)))
        const { data: commissions, error: commissionsError } = await supabase
          .from("category_commissions")
          .select("category, commission_percentage")
          .in("category", categories)
          .eq("is_active", true)

        if (commissionsError) {
          console.error("Error fetching commissions:", commissionsError)
        }

        const commissionsMap = new Map(
          (commissions || []).map((c: any) => [c.category, parseFloat(c.commission_percentage.toString())])
        )

        // Default commission if category not found
        const defaultCommission = 5.0

        // Create transaction records for each shop
        const transactions = []
        const shopTransactionMap = new Map<string, { sellerAmount: number; itemCount: number }>()
        
        for (const [shopId, shopItems] of shopItemsMap.entries()) {
          // Calculate total amount for this shop
          const shopTotal = shopItems.reduce((sum, item: any) => sum + parseFloat(item.total_price.toString()), 0)

          // Calculate commission (use first item's category for commission calculation)
          const firstItemCategory = (shopItems[0] as any)?.parts?.category
          const commissionPercentage = commissionsMap.get(firstItemCategory) || defaultCommission
          const commissionAmount = (shopTotal * commissionPercentage) / 100
          const sellerAmount = shopTotal - commissionAmount

          transactions.push({
            order_id: orderId,
            amount: shopTotal,
            commission_amount: commissionAmount,
            seller_amount: sellerAmount,
            status: "completed",
            payment_method: "payfast",
            payment_intent_id: paymentId,
            escrow_status: "held", // Funds held in escrow until order is delivered
            completed_at: new Date().toISOString(),
          })

          // Store shop transaction data for analytics update
          shopTransactionMap.set(shopId, {
            sellerAmount,
            itemCount: shopItems.length,
          })
        }

        // Insert transactions
        if (transactions.length > 0) {
          const { error: transactionsError } = await supabase
            .from("transactions")
            .insert(transactions)

          if (transactionsError) {
            console.error("Error creating transactions:", transactionsError)
            return NextResponse.json({ error: "Failed to create transactions" }, { status: 500 })
          }
        }

        // Add funds to locked_balance for each shop (escrow until delivery)
        try {
          for (const [shopId, transactionData] of shopTransactionMap.entries()) {
            // Get current locked_balance and update it
            const { data: currentShop, error: fetchShopError } = await supabase
              .from("shops")
              .select("locked_balance")
              .eq("id", shopId)
              .single()

            if (fetchShopError) {
              console.error(`Error fetching shop ${shopId}:`, fetchShopError)
            } else {
              const currentLockedBalance = parseFloat(currentShop?.locked_balance?.toString() || "0")
              const newLockedBalance = currentLockedBalance + transactionData.sellerAmount

              const { error: updateError } = await supabase
                .from("shops")
                .update({ 
                  locked_balance: newLockedBalance,
                  updated_at: new Date().toISOString()
                })
                .eq("id", shopId)

              if (updateError) {
                console.error(`Error updating locked_balance for shop ${shopId}:`, updateError)
              }
            }

            // Also update shop_analytics for order tracking (but not total_sales - that happens on delivery)
            const today = new Date().toISOString().split("T")[0]
            const { data: existingAnalytics, error: fetchError } = await supabase
              .from("shop_analytics")
              .select("orders_count, sold_listings")
              .eq("shop_id", shopId)
              .eq("date", today)
              .single()

            if (fetchError && fetchError.code !== "PGRST116") {
              console.error(`Error fetching shop_analytics for shop ${shopId}:`, fetchError)
              continue
            }

            if (existingAnalytics) {
              await supabase
                .from("shop_analytics")
                .update({
                  orders_count: (existingAnalytics.orders_count || 0) + 1,
                  sold_listings: (existingAnalytics.sold_listings || 0) + transactionData.itemCount,
                })
                .eq("shop_id", shopId)
                .eq("date", today)
            } else {
              await supabase
                .from("shop_analytics")
                .insert({
                  shop_id: shopId,
                  date: today,
                  orders_count: 1,
                  sold_listings: transactionData.itemCount,
                })
            }
          }
        } catch (error) {
          console.error("Error updating locked balance:", error)
          // Don't fail the payment notification, just log the error
        }

        // Decrement inventory for each part
        try {
          for (const item of orderItems) {
            // Get current stock quantity
            const { data: part, error: fetchError } = await supabase
              .from("parts")
              .select("stock_quantity")
              .eq("id", item.part_id)
              .single()

            if (fetchError) {
              console.error(`Error fetching part ${item.part_id}:`, fetchError)
              continue
            }

            if (part) {
              const newStockQuantity = Math.max(0, (part.stock_quantity || 0) - item.quantity)
              
              const { error: inventoryError } = await supabase
                .from("parts")
                .update({
                  stock_quantity: newStockQuantity,
                })
                .eq("id", item.part_id)

              if (inventoryError) {
                console.error(`Error decrementing inventory for part ${item.part_id}:`, inventoryError)
                // Continue processing other items even if one fails
              }
            }
          }
        } catch (error) {
          console.error("Error decrementing inventory:", error)
          // Don't fail the payment notification, just log the error
        }

        break

      case "FAILED":
        
        if (orderId) {
          // Check if order exists
          const { data: existingOrder, error: fetchError } = await supabase
            .from("orders")
            .select("id")
            .eq("id", orderId)
            .single()

          if (fetchError || !existingOrder) {
            console.error("PayFast IPN: Order not found for FAILED status", orderId, fetchError)
            break
          }

          const { data: updatedOrder, error: updateError } = await supabase
            .from("orders")
            .update({
              payment_status: "failed",
              updated_at: new Date().toISOString(),
            })
            .eq("id", orderId)
            .select()
            .single()

          if (updateError) {
            console.error("Error updating order status:", updateError)
          } else if (!updatedOrder) {
            console.error("PayFast IPN: Order update did not affect any rows", orderId)
          }
        }
        break

      case "PENDING":
        
        if (orderId) {
          // Check if order exists
          const { data: existingOrder, error: fetchError } = await supabase
            .from("orders")
            .select("id")
            .eq("id", orderId)
            .single()

          if (fetchError || !existingOrder) {
            console.error("PayFast IPN: Order not found for PENDING status", orderId, fetchError)
            break
          }

          const { data: updatedOrder, error: updateError } = await supabase
            .from("orders")
            .update({
              payment_status: "pending",
              updated_at: new Date().toISOString(),
            })
            .eq("id", orderId)
            .select()
            .single()

          if (updateError) {
            console.error("Error updating order status:", updateError)
          } else if (!updatedOrder) {
            console.error("PayFast IPN: Order update did not affect any rows", orderId)
          }
        }
        break

      default:
    }

    // PayFast requires a 200 OK response
    return new NextResponse("OK", { status: 200 })
  } catch (error) {
    console.error("PayFast IPN error:", error)
    return NextResponse.json({ error: "IPN processing failed" }, { status: 500 })
  }
}

const generateSignature = (data: Record<string, string>, passPhrase: string | null = null) => {
  // Create parameter string
  let pfOutput = "";
  for (let key in data) {
    if(data.hasOwnProperty(key) && key !== "signature"){
      const encoded = encodeURIComponent(data[key].trim())
        .replace(/%20/g, "+")
        .replace(/\(/g, "%28")
        .replace(/\)/g, "%29")
      pfOutput +=`${key}=${encoded}&`
    }
  }

  // Remove last ampersand
  let getString = pfOutput.slice(0, -1);
  if (passPhrase !== null) {
    const encodedPass = encodeURIComponent(passPhrase.trim())
      .replace(/%20/g, "+")
      .replace(/\(/g, "%28")
      .replace(/\)/g, "%29")
    getString +=`&passphrase=${encodedPass}`;
  }

  return crypto.createHash("md5").update(getString).digest("hex");
}; 