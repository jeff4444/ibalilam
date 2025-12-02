import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { cookies } from "next/headers"

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

    // Get user's shop
    const { data: shop, error: shopError } = await supabase
      .from("shops")
      .select("id")
      .eq("user_id", user.id)
      .single()

    if (shopError || !shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 })
    }

    // Verify order belongs to this shop
    const { data: existingOrder, error: orderError } = await supabase
      .from("orders")
      .select("id, shop_id, status")
      .eq("id", orderId)
      .single()

    if (orderError || !existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    if (existingOrder.shop_id !== shop.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const { 
      status, 
      internal_notes, 
      tracking_number, 
      carrier, 
      tracking_url 
    } = body

    // Build update object
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    }

    // Update status if provided
    if (status !== undefined) {
      const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 })
      }

      // Define status progression order (sellers can only move forward, not backward)
      const statusOrder: Record<string, number> = {
        'pending': 0,
        'confirmed': 1,
        'processing': 2,
        'shipped': 3,
        'delivered': 4,
      }

      const currentStatusOrder = statusOrder[existingOrder.status]
      const newStatusOrder = statusOrder[status]

      // Allow cancelled and refunded from any status
      // But don't allow going backward in the main progression
      if (status !== 'cancelled' && status !== 'refunded') {
        if (currentStatusOrder !== undefined && newStatusOrder !== undefined) {
          if (newStatusOrder < currentStatusOrder) {
            return NextResponse.json({ 
              error: `Cannot change status from "${existingOrder.status}" to "${status}". Orders can only progress forward.` 
            }, { status: 400 })
          }
        }
      }

      updateData.status = status

      // Update timestamps based on status change
      if (status === 'shipped' && existingOrder.status !== 'shipped') {
        updateData.shipped_at = new Date().toISOString()
      }
      if (status === 'delivered' && existingOrder.status !== 'delivered') {
        updateData.delivered_at = new Date().toISOString()
      }
    }

    // Update internal notes if provided
    if (internal_notes !== undefined) {
      updateData.internal_notes = internal_notes
    }

    // Update tracking information if provided
    if (tracking_number !== undefined) {
      updateData.tracking_number = tracking_number
    }
    if (carrier !== undefined) {
      updateData.carrier = carrier
    }
    if (tracking_url !== undefined) {
      updateData.tracking_url = tracking_url
    }

    // Perform the update
    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId)
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
        )
      `)
      .single()

    if (updateError) {
      console.error("Error updating order:", updateError)
      return NextResponse.json(
        { error: "Failed to update order" },
        { status: 500 }
      )
    }

    // If order was marked as delivered, release escrow funds from user wallet
    if (status === 'delivered' && existingOrder.status !== 'delivered') {
      try {
        // Get the transaction for this order to find the seller_amount
        const { data: transaction, error: transactionError } = await supabase
          .from("transactions")
          .select("id, seller_amount, escrow_status")
          .eq("order_id", orderId)
          .single()

        if (transactionError) {
          console.error("Error fetching transaction for escrow release:", transactionError)
        } else if (transaction && transaction.escrow_status === 'held') {
          const sellerAmount = parseFloat(transaction.seller_amount?.toString() || "0")

          // Get seller's wallet
          const { data: wallet, error: walletError } = await supabase
            .from("user_wallets")
            .select("id, locked_balance, available_balance")
            .eq("user_id", user.id)
            .single()

          if (walletError) {
            console.error("Error fetching wallet for escrow release:", walletError)
          } else if (wallet) {
            const currentLockedBalance = parseFloat(wallet.locked_balance?.toString() || "0")
            const currentAvailableBalance = parseFloat(wallet.available_balance?.toString() || "0")

            // Calculate new balances (ensure locked_balance doesn't go negative)
            const amountToRelease = Math.min(sellerAmount, currentLockedBalance)
            const newLockedBalance = currentLockedBalance - amountToRelease
            const newAvailableBalance = currentAvailableBalance + amountToRelease

            // Update wallet balances
            const { error: walletUpdateError } = await supabase
              .from("user_wallets")
              .update({
                locked_balance: newLockedBalance,
                available_balance: newAvailableBalance,
                updated_at: new Date().toISOString()
              })
              .eq("id", wallet.id)

            if (walletUpdateError) {
              console.error("Error releasing wallet escrow funds:", walletUpdateError)
            } else {
              // Create wallet transaction record for escrow release
              await supabase
                .from("wallet_transactions")
                .insert({
                  wallet_id: wallet.id,
                  transaction_type: "escrow_release",
                  amount: amountToRelease,
                  status: "completed",
                  reference_id: orderId,
                  reference_type: "order",
                  description: `Escrow released - Order delivered`,
                  balance_after: newAvailableBalance
                })

              // Update transaction escrow_status to released
              await supabase
                .from("transactions")
                .update({ escrow_status: "released" })
                .eq("id", transaction.id)
            }
          }

          // Also update shop balances for backward compatibility
          const { data: currentShop, error: fetchShopError } = await supabase
            .from("shops")
            .select("locked_balance, available_balance")
            .eq("id", shop.id)
            .single()

          if (!fetchShopError && currentShop) {
            const shopLockedBalance = parseFloat(currentShop.locked_balance?.toString() || "0")
            const shopAvailableBalance = parseFloat(currentShop.available_balance?.toString() || "0")
            const shopAmountToRelease = Math.min(sellerAmount, shopLockedBalance)

            await supabase
              .from("shops")
              .update({
                locked_balance: shopLockedBalance - shopAmountToRelease,
                available_balance: shopAvailableBalance + shopAmountToRelease,
                updated_at: new Date().toISOString()
              })
              .eq("id", shop.id)
          }

              // Update shop_analytics total_sales for historical tracking
              const today = new Date().toISOString().split("T")[0]
              const { data: existingAnalytics, error: analyticsError } = await supabase
                .from("shop_analytics")
                .select("total_sales")
                .eq("shop_id", shop.id)
                .eq("date", today)
                .single()

              if (!analyticsError && existingAnalytics) {
                const currentTotalSales = parseFloat(existingAnalytics.total_sales?.toString() || "0")
                await supabase
                  .from("shop_analytics")
              .update({ total_sales: currentTotalSales + sellerAmount })
                  .eq("shop_id", shop.id)
                  .eq("date", today)
              } else if (analyticsError?.code === "PGRST116") {
                // No analytics record for today, create one
                await supabase
                  .from("shop_analytics")
                  .insert({
                    shop_id: shop.id,
                    date: today,
                total_sales: sellerAmount,
                  })
          }
        }
      } catch (escrowError) {
        console.error("Error processing escrow release:", escrowError)
        // Don't fail the order update, just log the error
      }
    }

    return NextResponse.json({ order: updatedOrder })
  } catch (error) {
    console.error("Error in PATCH /api/seller/orders/[orderId]:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

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

    // Get user's shop
    const { data: shop, error: shopError } = await supabase
      .from("shops")
      .select("id")
      .eq("user_id", user.id)
      .single()

    if (shopError || !shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 })
    }

    // Fetch order with verification
    const { data: order, error: orderError } = await supabase
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
        )
      `)
      .eq("id", orderId)
      .eq("shop_id", shop.id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    return NextResponse.json({ order })
  } catch (error) {
    console.error("Error in GET /api/seller/orders/[orderId]:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

