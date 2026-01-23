import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { cookies } from "next/headers"
import crypto from "crypto"
import { logger } from "@/lib/logger"

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient(cookies())
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { orderId, itemName, email, firstName, lastName } = body

    // SECURITY FIX: orderId is now REQUIRED - we fetch the amount from the database
    // This prevents client-side price manipulation (VULN-001)
    if (!orderId) {
      return NextResponse.json(
        { error: "Missing required field: orderId" },
        { status: 400 }
      )
    }

    if (!itemName || !email) {
      return NextResponse.json(
        { error: "Missing required fields: itemName, email" },
        { status: 400 }
      )
    }

    // SECURITY FIX: Fetch the order from the database to get the verified total_amount
    // This ensures the payment amount comes from our server-calculated value, not the client
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, total_amount, customer_id, payment_status")
      .eq("id", orderId)
      .single()

    if (orderError || !order) {
      logger.error("Error fetching order:", orderError)
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      )
    }

    // Verify the order belongs to the authenticated user
    if (order.customer_id !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized: Order does not belong to this user" },
        { status: 403 }
      )
    }

    // Verify the order hasn't already been paid
    if (order.payment_status === "paid" || order.payment_status === "completed") {
      return NextResponse.json(
        { error: "Order has already been paid" },
        { status: 400 }
      )
    }

    // Use the server-stored total_amount from the order (calculated during order creation)
    const verifiedAmount = parseFloat(order.total_amount.toString())

    if (isNaN(verifiedAmount) || verifiedAmount <= 0) {
      return NextResponse.json(
        { error: "Invalid order amount" },
        { status: 400 }
      )
    }

    // Get environment variables
    const merchantId = process.env.MERCHANT_ID
    const merchantKey = process.env.MERCHANT_KEY
    const passphrase = process.env.PAYFAST_PASSPHRASE
    const payfastUrl = process.env.PAYFAST_URL
    // VULN-023 FIX: Standardize on NEXT_PUBLIC_APP_URL with fallbacks
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL

    if (!merchantId || !merchantKey || !passphrase || !payfastUrl || !baseUrl) {
      logger.error('PayFast configuration missing:', {
        merchantId: !!merchantId,
        merchantKey: !!merchantKey,
        passphrase: !!passphrase,
        payfastUrl: !!payfastUrl,
        baseUrl: !!baseUrl
      })
      return NextResponse.json(
        { error: "PayFast credentials not configured" },
        { status: 500 }
      )
    }

    // Build PayFast data object using the VERIFIED amount from the database
    const payfastData: Record<string, string> = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: `${baseUrl}/orders/${orderId}?payment_success=true`,
      cancel_url: `${baseUrl}/payment/cancelled?orderId=${orderId}`,
      notify_url: `${baseUrl}/api/payfast/notify`,
      name_first: firstName || "",
      name_last: lastName || "",
      email_address: email,
      amount: verifiedAmount.toFixed(2), // Use verified amount from database
      item_name: itemName,
      custom_str1: orderId, // Store order ID for webhook verification
    }

    // Generate signature
    const signature = generateSignature(payfastData, passphrase)
    payfastData.signature = signature

    return NextResponse.json({
      payfastUrl,
      payfastData,
      // Return the verified amount so client can display it
      verifiedAmount: verifiedAmount,
    })
  } catch (error) {
    logger.error("PayFast payment generation error:", error)
    return NextResponse.json(
      { error: "Failed to generate payment data" },
      { status: 500 }
    )
  }
}

const generateSignature = (data: Record<string, string>, passPhrase: string | null = null) => {
  // Create parameter string
  let pfOutput = "";
  for (let key in data) {
    if(data.hasOwnProperty(key)){
      if (data[key] !== "") {
        const encoded = encodeURIComponent(data[key].trim())
          .replace(/%20/g, "+")
          .replace(/\(/g, "%28")
          .replace(/\)/g, "%29")
        pfOutput +=`${key}=${encoded}&`
      }
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
}
