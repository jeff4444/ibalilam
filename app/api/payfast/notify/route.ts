import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { supabaseAdmin } from "@/utils/supabase/admin"
import { 
  validatePayFastSource, 
  validatePayFastIPNWithServer, 
  amountMatchesInCents,
  toCents,
  createAuditLogEntry,
  type PayFastAuditLogEntry
} from "@/lib/payfast-security"

/**
 * PayFast IPN (Instant Payment Notification) Handler
 * 
 * Security validations performed in order:
 * 1. IP Validation - Reject if not from PayFast IPs (VULN-002)
 * 2. Signature Validation - Reject if signature mismatch
 * 3. Server-to-Server Validation - POST data back to PayFast API (VULN-003)
 * 4. Merchant ID Verification - Reject if merchant_id doesn't match
 * 5. Order Existence Check - Reject if order not found
 * 6. Idempotency Check - Skip if already paid
 * 7. Amount Verification - Reject if amounts don't match in cents (VULN-003)
 * 8. Atomic Update - Use optimistic locking (VULN-003)
 */

// Helper function for structured audit logging
function logAudit(entry: Omit<PayFastAuditLogEntry, "timestamp">) {
  const logEntry = createAuditLogEntry({
    ...entry,
    timestamp: new Date().toISOString(),
  })
  console.log(`[PAYFAST_AUDIT] ${logEntry}`)
}

export async function POST(req: NextRequest) {
  const requestTimestamp = new Date().toISOString()
  let orderId: string | undefined
  let paymentId: string | undefined
  let clientIP: string | null = null

  try {
    // ============================================================
    // STEP 1: IP Validation (VULN-002)
    // ============================================================
    const { isValid: isValidIP, clientIP: extractedIP } = validatePayFastSource(req)
    clientIP = extractedIP

    logAudit({
      event_type: "ipn_received",
      success: true,
      client_ip: clientIP || undefined,
      details: { timestamp: requestTimestamp },
    })

    if (!isValidIP) {
      logAudit({
        event_type: "ip_validation",
        success: false,
        client_ip: clientIP || undefined,
        error_message: "Invalid source IP address",
      })
      return NextResponse.json(
        { error: "Forbidden: Invalid source IP" },
        { status: 403 }
      )
    }

    logAudit({
      event_type: "ip_validation",
      success: true,
      client_ip: clientIP || undefined,
    })

    const formData = await req.formData()
    const data: Record<string, string> = {}

    // Convert FormData to object, preserving order for signature validation
    formData.forEach((value, key) => {
      data[key] = value.toString()
    })

    // Extract key fields early for logging
    orderId = data.custom_str1
    paymentId = data.pf_payment_id || data.m_payment_id

    // ============================================================
    // STEP 2: Signature Validation
    // ============================================================
    const signature = data.signature
    const dataWithoutSignature = { ...data }
    delete dataWithoutSignature.signature

    const passphrase = process.env.PAYFAST_PASSPHRASE
    const generatedSignature = generateSignature(dataWithoutSignature, passphrase)

    if (signature !== generatedSignature) {
      logAudit({
        event_type: "signature_validation",
        success: false,
        order_id: orderId,
        payment_id: paymentId,
        client_ip: clientIP || undefined,
        error_message: "Signature mismatch",
        details: { received: signature?.substring(0, 8) + "...", expected: generatedSignature.substring(0, 8) + "..." },
      })
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }

    logAudit({
      event_type: "signature_validation",
      success: true,
      order_id: orderId,
      payment_id: paymentId,
      client_ip: clientIP || undefined,
    })

    // ============================================================
    // STEP 3: Server-to-Server Validation with PayFast (VULN-003)
    // ============================================================
    const serverValidation = await validatePayFastIPNWithServer(dataWithoutSignature, passphrase || null)
    
    if (!serverValidation.isValid) {
      logAudit({
        event_type: "server_validation",
        success: false,
        order_id: orderId,
        payment_id: paymentId,
        client_ip: clientIP || undefined,
        error_message: serverValidation.error || "Server validation failed",
      })
      return NextResponse.json(
        { error: "PayFast server validation failed" },
        { status: 400 }
      )
    }

    logAudit({
      event_type: "server_validation",
      success: true,
      order_id: orderId,
      payment_id: paymentId,
      client_ip: clientIP || undefined,
    })

    // ============================================================
    // STEP 4: Merchant ID Verification
    // ============================================================
    const paymentStatus = data.payment_status
    const merchantId = data.merchant_id
    const amount = data.amount_gross
    const itemName = data.item_name

    if (merchantId !== process.env.MERCHANT_ID) {
      logAudit({
        event_type: "error",
        success: false,
        order_id: orderId,
        payment_id: paymentId,
        client_ip: clientIP || undefined,
        error_message: "Merchant ID mismatch",
        details: { received: merchantId, expected: process.env.MERCHANT_ID?.substring(0, 4) + "..." },
      })
      return NextResponse.json({ error: "Invalid merchant ID" }, { status: 400 })
    }

    // Use admin client for webhook processing
    const supabase = supabaseAdmin

    // Process the payment based on status
    switch (paymentStatus) {
      case "COMPLETE":
        
        if (!orderId) {
          logAudit({
            event_type: "error",
            success: false,
            payment_id: paymentId,
            client_ip: clientIP || undefined,
            error_message: "Order ID missing from IPN",
          })
          return NextResponse.json({ error: "Order ID missing" }, { status: 400 })
        }

        // ============================================================
        // STEP 5: Order Existence Check
        // ============================================================
        const { data: existingOrder, error: fetchError } = await supabase
          .from("orders")
          .select("id, total_amount, payment_status")
          .eq("id", orderId)
          .single()

        if (fetchError || !existingOrder) {
          logAudit({
            event_type: "error",
            success: false,
            order_id: orderId,
            payment_id: paymentId,
            client_ip: clientIP || undefined,
            error_message: "Order not found",
            details: { error: fetchError?.message },
          })
          return NextResponse.json({ error: "Order not found" }, { status: 404 })
        }

        // ============================================================
        // STEP 6: Idempotency Check
        // ============================================================
        if (existingOrder.payment_status === "paid" || existingOrder.payment_status === "completed") {
          logAudit({
            event_type: "order_update",
            success: true,
            order_id: orderId,
            payment_id: paymentId,
            client_ip: clientIP || undefined,
            details: { action: "skipped", reason: "already_paid", current_status: existingOrder.payment_status },
          })
          return new NextResponse("OK", { status: 200 })
        }

        // ============================================================
        // STEP 7: Amount Verification in Cents (VULN-003 Enhanced)
        // ============================================================
        const ipnAmountCents = toCents(amount)
        const orderAmountCents = toCents(existingOrder.total_amount?.toString() || "0")

        // Validate both amounts could be parsed
        if (ipnAmountCents === null || orderAmountCents === null) {
          logAudit({
            event_type: "amount_validation",
            success: false,
            order_id: orderId,
            payment_id: paymentId,
            client_ip: clientIP || undefined,
            error_message: "Invalid amount format",
            details: { 
              ipn_amount: amount, 
              order_amount: existingOrder.total_amount,
              ipn_cents: ipnAmountCents,
              order_cents: orderAmountCents,
            },
          })
          return NextResponse.json({ error: "Invalid amount format" }, { status: 400 })
        }

        // Use integer comparison for exact match (no floating point issues)
        if (!amountMatchesInCents(amount, existingOrder.total_amount?.toString() || "0")) {
          logAudit({
            event_type: "amount_validation",
            success: false,
            order_id: orderId,
            payment_id: paymentId,
            client_ip: clientIP || undefined,
            error_message: "Amount mismatch detected - possible payment manipulation attempt",
            details: { 
              ipn_amount: amount, 
              ipn_cents: ipnAmountCents,
              order_amount: existingOrder.total_amount,
              order_cents: orderAmountCents,
              difference_cents: Math.abs(ipnAmountCents - orderAmountCents),
            },
          })
          return NextResponse.json({ error: "Amount mismatch" }, { status: 400 })
        }

        logAudit({
          event_type: "amount_validation",
          success: true,
          order_id: orderId,
          payment_id: paymentId,
          client_ip: clientIP || undefined,
          details: { amount_cents: ipnAmountCents },
        })

        // ============================================================
        // STEP 8: Atomic Update with Optimistic Locking (VULN-003)
        // ============================================================
        // Use WHERE clause to ensure we only update if payment_status is still pending
        // This prevents race conditions where multiple IPNs could process the same order
        const { data: updatedOrder, error: updateError } = await supabase
          .from("orders")
          .update({
            payment_status: "paid",
            status: "confirmed",
            payment_intent_id: paymentId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId)
          .neq("payment_status", "paid")      // Optimistic lock: only update if not already paid
          .neq("payment_status", "completed") // Also check for completed status
          .select()
          .single()

        if (updateError) {
          // Check if this is a "no rows returned" error (PGRST116) which means
          // the optimistic lock failed - order was already updated by another request
          if (updateError.code === "PGRST116") {
            logAudit({
              event_type: "order_update",
              success: true,
              order_id: orderId,
              payment_id: paymentId,
              client_ip: clientIP || undefined,
              details: { action: "skipped", reason: "concurrent_update_detected" },
            })
            // Return success - the order was already processed
            return new NextResponse("OK", { status: 200 })
          }
          
          logAudit({
            event_type: "order_update",
            success: false,
            order_id: orderId,
            payment_id: paymentId,
            client_ip: clientIP || undefined,
            error_message: "Database update failed",
            details: { error: updateError.message, code: updateError.code },
          })
          return NextResponse.json({ error: "Failed to update order" }, { status: 500 })
        }

        if (!updatedOrder) {
          // No rows affected - likely a race condition where another request already processed this
          logAudit({
            event_type: "order_update",
            success: true,
            order_id: orderId,
            payment_id: paymentId,
            client_ip: clientIP || undefined,
            details: { action: "skipped", reason: "no_rows_affected_optimistic_lock" },
          })
          return new NextResponse("OK", { status: 200 })
        }

        logAudit({
          event_type: "order_update",
          success: true,
          order_id: orderId,
          payment_id: paymentId,
          client_ip: clientIP || undefined,
          details: { 
            action: "payment_confirmed",
            new_status: "paid",
            amount_cents: ipnAmountCents,
          },
        })

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

        // Fetch VAT and Payfast fee settings from global_settings
        const { data: feeSettings, error: feeSettingsError } = await supabase
          .from("global_settings")
          .select("setting_key, setting_value")
          .in("setting_key", ["vat_percentage", "payfast_fee_percentage"])

        if (feeSettingsError) {
          console.error("Error fetching fee settings:", feeSettingsError)
        }

        // Fetch feature flags for enabling/disabling fees
        const { data: feeFlags, error: feeFlagsError } = await supabase
          .from("feature_flags")
          .select("flag_name, flag_value")
          .in("flag_name", ["enable_vat_fees", "enable_payfast_fees"])

        if (feeFlagsError) {
          console.error("Error fetching fee flags:", feeFlagsError)
        }

        // Parse fee settings with defaults
        const vatPercentage = parseFloat(
          feeSettings?.find(s => s.setting_key === "vat_percentage")?.setting_value || "15"
        )
        const payfastFeePercentage = parseFloat(
          feeSettings?.find(s => s.setting_key === "payfast_fee_percentage")?.setting_value || "3.4"
        )
        const enableVatFees = feeFlags?.find(f => f.flag_name === "enable_vat_fees")?.flag_value ?? true
        const enablePayfastFees = feeFlags?.find(f => f.flag_name === "enable_payfast_fees")?.flag_value ?? true

        // Create transaction records for each shop
        const transactions = []
        const shopTransactionMap = new Map<string, { sellerAmount: number; itemCount: number }>()
        
        for (const [shopId, shopItems] of shopItemsMap.entries()) {
          // Calculate total amount for this shop (listing price paid by buyer)
          const shopTotal = shopItems.reduce((sum, item: any) => sum + parseFloat(item.total_price.toString()), 0)

          // Calculate commission (use first item's category for commission calculation)
          const firstItemCategory = (shopItems[0] as any)?.parts?.category
          const commissionPercentage = commissionsMap.get(firstItemCategory) || defaultCommission
          
          // Calculate all fees from the listing price
          const vatAmount = enableVatFees ? (shopTotal * vatPercentage) / 100 : 0
          const payfastAmount = enablePayfastFees ? (shopTotal * payfastFeePercentage) / 100 : 0
          const commissionAmount = (shopTotal * commissionPercentage) / 100
          
          // Total fees and seller amount
          const totalFees = vatAmount + payfastAmount + commissionAmount
          const sellerAmount = shopTotal - totalFees

          console.log(`Order ${orderId} - Shop ${shopId} fee breakdown:`, {
            shopTotal,
            vatAmount: enableVatFees ? vatAmount : 'disabled',
            payfastAmount: enablePayfastFees ? payfastAmount : 'disabled',
            commissionAmount,
            totalFees,
            sellerAmount
          })

          transactions.push({
            order_id: orderId,
            amount: shopTotal,
            commission_amount: totalFees, // Store total fees (VAT + Payfast + Commission) in commission_amount for now
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

        // Add funds to seller's user wallet escrow (locked_balance) for each shop
        // SECURITY FIX (VULN-007): Use atomic function to update both wallet and shop
        // balances in a single transaction, preventing race conditions
        try {
          for (const [shopId, transactionData] of shopTransactionMap.entries()) {
            // Get the shop owner's user_id
            const { data: shop, error: fetchShopError } = await supabase
              .from("shops")
              .select("user_id")
              .eq("id", shopId)
              .single()

            if (fetchShopError || !shop) {
              console.error(`Error fetching shop ${shopId}:`, fetchShopError)
              continue
            }

            const sellerUserId = shop.user_id

            // ATOMIC ESCROW HOLD: Updates both wallet and shop balances atomically
            // - Uses FOR UPDATE row locking to prevent race conditions
            // - Includes idempotency check (won't double-process same order)
            // - Creates wallet_transaction record automatically
            const { data: escrowTxId, error: escrowError } = await supabase.rpc(
              'atomic_escrow_hold',
              {
                p_seller_user_id: sellerUserId,
                p_shop_id: shopId,
                p_amount: transactionData.sellerAmount,
                p_order_id: orderId,
                p_description: `Sale payment held in escrow - Order ${orderId?.slice(0, 8)}`
              }
            )

            if (escrowError) {
              console.error(`Error in atomic_escrow_hold for shop ${shopId}:`, escrowError)
            } else {
              console.log(`Escrow hold completed for shop ${shopId}, transaction: ${escrowTxId}`)
            }

            // Update shop_analytics for order tracking (but not total_sales - that happens on delivery)
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
          console.error("Error in atomic escrow hold:", error)
          // Don't fail the payment notification, just log the error
        }

        // Stock was already deducted at order creation time, no need to do anything here

        break

      case "FAILED":
        
        if (orderId) {
          // Check if order exists
          const { data: failedExistingOrder, error: failedFetchError } = await supabase
            .from("orders")
            .select("id")
            .eq("id", orderId)
            .single()

          if (failedFetchError || !failedExistingOrder) {
            logAudit({
              event_type: "error",
              success: false,
              order_id: orderId,
              payment_id: paymentId,
              client_ip: clientIP || undefined,
              error_message: "Order not found for FAILED status",
            })
            break
          }

          const { data: failedUpdatedOrder, error: failedUpdateError } = await supabase
            .from("orders")
            .update({
              payment_status: "failed",
              updated_at: new Date().toISOString(),
            })
            .eq("id", orderId)
            .select()
            .single()

          if (failedUpdateError) {
            logAudit({
              event_type: "order_update",
              success: false,
              order_id: orderId,
              payment_id: paymentId,
              client_ip: clientIP || undefined,
              error_message: "Failed to update order to failed status",
              details: { error: failedUpdateError.message },
            })
          } else if (failedUpdatedOrder) {
            logAudit({
              event_type: "order_update",
              success: true,
              order_id: orderId,
              payment_id: paymentId,
              client_ip: clientIP || undefined,
              details: { action: "payment_failed", new_status: "failed" },
            })
          }

          // ============================================================
          // Restore Stock for Failed Payment
          // ============================================================
          // Payment failed - restore the stock that was deducted at order creation
          try {
            // Get order items to restore stock
            const { data: failedOrderItems, error: failedItemsError } = await supabase
              .from("order_items")
              .select("part_id, quantity")
              .eq("order_id", orderId)

            if (failedItemsError) {
              console.error(`Error fetching order items for failed order ${orderId}:`, failedItemsError)
            } else if (failedOrderItems && failedOrderItems.length > 0) {
              // Restore stock for each item
              for (const item of failedOrderItems) {
                const { data: part } = await supabase
                  .from("parts")
                  .select("stock_quantity")
                  .eq("id", item.part_id)
                  .single()

                if (part) {
                  await supabase
                    .from("parts")
                    .update({ stock_quantity: part.stock_quantity + item.quantity })
                    .eq("id", item.part_id)
                }
              }
              console.log(`Stock restored for failed order ${orderId}`)
              logAudit({
                event_type: "order_update",
                success: true,
                order_id: orderId,
                payment_id: paymentId,
                client_ip: clientIP || undefined,
                details: { 
                  action: "stock_released",
                  reason: "payment_failed",
                  items_count: failedOrderItems.length
                },
              })
            }
          } catch (error) {
            console.error("Error restoring stock for failed payment:", error)
            // The stock restoration failed but we shouldn't fail the IPN
          }
        }
        break

      case "PENDING":
        
        if (orderId) {
          // Check if order exists
          const { data: pendingExistingOrder, error: pendingFetchError } = await supabase
            .from("orders")
            .select("id")
            .eq("id", orderId)
            .single()

          if (pendingFetchError || !pendingExistingOrder) {
            logAudit({
              event_type: "error",
              success: false,
              order_id: orderId,
              payment_id: paymentId,
              client_ip: clientIP || undefined,
              error_message: "Order not found for PENDING status",
            })
            break
          }

          const { data: pendingUpdatedOrder, error: pendingUpdateError } = await supabase
            .from("orders")
            .update({
              payment_status: "pending",
              updated_at: new Date().toISOString(),
            })
            .eq("id", orderId)
            .select()
            .single()

          if (pendingUpdateError) {
            logAudit({
              event_type: "order_update",
              success: false,
              order_id: orderId,
              payment_id: paymentId,
              client_ip: clientIP || undefined,
              error_message: "Failed to update order to pending status",
              details: { error: pendingUpdateError.message },
            })
          } else if (pendingUpdatedOrder) {
            logAudit({
              event_type: "order_update",
              success: true,
              order_id: orderId,
              payment_id: paymentId,
              client_ip: clientIP || undefined,
              details: { action: "payment_pending", new_status: "pending" },
            })
          }
        }
        break

      default:
        logAudit({
          event_type: "error",
          success: false,
          order_id: orderId,
          payment_id: paymentId,
          client_ip: clientIP || undefined,
          error_message: `Unknown payment status: ${paymentStatus}`,
        })
    }

    // PayFast requires a 200 OK response
    return new NextResponse("OK", { status: 200 })
  } catch (error) {
    logAudit({
      event_type: "error",
      success: false,
      order_id: orderId,
      payment_id: paymentId,
      client_ip: clientIP || undefined,
      error_message: `IPN processing failed: ${(error as Error).message}`,
      details: { stack: (error as Error).stack?.substring(0, 500) },
    })
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