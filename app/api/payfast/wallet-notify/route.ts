import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { supabaseAdmin } from "@/utils/supabase/admin"
import { validatePayFastSource } from "@/lib/payfast-security"

export async function POST(req: NextRequest) {
  try {
    // SECURITY FIX (VULN-002/VULN-014): Validate request originates from PayFast IP addresses
    // This MUST be the first validation step before any processing
    const { isValid: isValidIP, clientIP } = validatePayFastSource(req)
    if (!isValidIP) {
      console.error(`PayFast Wallet IPN: Rejected - Invalid source IP: ${clientIP}`)
      return NextResponse.json(
        { error: "Forbidden: Invalid source IP" },
        { status: 403 }
      )
    }

    const formData = await req.formData()
    const data: Record<string, string> = {}

    // Convert FormData to object
    formData.forEach((value, key) => {
      data[key] = value.toString()
    })

    console.log("PayFast Wallet IPN received from IP:", clientIP)

    // Validate signature
    const signature = data.signature
    delete data.signature

    const passphrase = process.env.PAYFAST_PASSPHRASE
    const generatedSignature = generateSignature(data, passphrase)

    if (signature !== generatedSignature) {
      console.error("PayFast Wallet IPN: Invalid signature")
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }

    // Verify payment status
    const paymentStatus = data.payment_status
    const merchantId = data.merchant_id
    const amount = parseFloat(data.amount_gross)
    const userId = data.custom_str1 // User ID from deposit request
    const transactionId = data.custom_str2 // Pending transaction ID
    const transactionType = data.custom_str3 // Should be 'wallet_deposit'
    const payfastPaymentId = data.pf_payment_id || data.m_payment_id

    // Verify this is a wallet deposit
    if (transactionType !== 'wallet_deposit') {
      console.error("PayFast Wallet IPN: Not a wallet deposit transaction")
      return NextResponse.json({ error: "Invalid transaction type" }, { status: 400 })
    }

    // Verify merchant_id matches
    if (merchantId !== process.env.MERCHANT_ID) {
      console.error("PayFast Wallet IPN: Invalid merchant ID")
      return NextResponse.json({ error: "Invalid merchant ID" }, { status: 400 })
    }

    // Use admin client for webhook processing
    const supabase = supabaseAdmin

    // Process the payment based on status
    switch (paymentStatus) {
      case "COMPLETE":
        if (!userId || !transactionId) {
          console.error("PayFast Wallet IPN: Missing user ID or transaction ID")
          return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        // Get the pending transaction
        const { data: pendingTx, error: fetchTxError } = await supabase
          .from("wallet_transactions")
          .select("id, wallet_id, status, amount")
          .eq("id", transactionId)
          .single()

        if (fetchTxError || !pendingTx) {
          console.error("PayFast Wallet IPN: Transaction not found", transactionId)
          return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
        }

        // Check if already processed
        if (pendingTx.status === 'completed') {
          console.log("PayFast Wallet IPN: Transaction already processed")
          return new NextResponse("OK", { status: 200 })
        }

        // Get the wallet
        const { data: wallet, error: walletError } = await supabase
          .from("user_wallets")
          .select("id, available_balance, total_deposited, user_id")
          .eq("id", pendingTx.wallet_id)
          .single()

        if (walletError || !wallet) {
          console.error("PayFast Wallet IPN: Wallet not found")
          return NextResponse.json({ error: "Wallet not found" }, { status: 404 })
        }

        // Verify user ID matches
        if (wallet.user_id !== userId) {
          console.error("PayFast Wallet IPN: User ID mismatch")
          return NextResponse.json({ error: "User mismatch" }, { status: 400 })
        }

        // Calculate new balances
        const currentBalance = parseFloat(wallet.available_balance) || 0
        const currentTotalDeposited = parseFloat(wallet.total_deposited) || 0
        const newBalance = currentBalance + amount
        const newTotalDeposited = currentTotalDeposited + amount

        // Update wallet balance
        const { error: updateWalletError } = await supabase
          .from("user_wallets")
          .update({
            available_balance: newBalance,
            total_deposited: newTotalDeposited,
            updated_at: new Date().toISOString()
          })
          .eq("id", wallet.id)

        if (updateWalletError) {
          console.error("PayFast Wallet IPN: Failed to update wallet", updateWalletError)
          return NextResponse.json({ error: "Failed to update wallet" }, { status: 500 })
        }

        // Update transaction status
        const { error: updateTxError } = await supabase
          .from("wallet_transactions")
          .update({
            status: 'completed',
            balance_after: newBalance,
            payfast_payment_id: payfastPaymentId,
            updated_at: new Date().toISOString()
          })
          .eq("id", transactionId)

        if (updateTxError) {
          console.error("PayFast Wallet IPN: Failed to update transaction", updateTxError)
          return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 })
        }

        console.log(`PayFast Wallet IPN: Deposit of R${amount} completed for user ${userId}`)
        break

      case "FAILED":
        if (transactionId) {
          await supabase
            .from("wallet_transactions")
            .update({
              status: 'failed',
              updated_at: new Date().toISOString()
            })
            .eq("id", transactionId)
        }
        console.log("PayFast Wallet IPN: Payment failed")
        break

      case "PENDING":
        // Transaction still pending, no action needed
        console.log("PayFast Wallet IPN: Payment pending")
        break

      case "CANCELLED":
        if (transactionId) {
          await supabase
            .from("wallet_transactions")
            .update({
              status: 'cancelled',
              updated_at: new Date().toISOString()
            })
            .eq("id", transactionId)
        }
        console.log("PayFast Wallet IPN: Payment cancelled")
        break

      default:
        console.log(`PayFast Wallet IPN: Unknown status ${paymentStatus}`)
    }

    // PayFast requires a 200 OK response
    return new NextResponse("OK", { status: 200 })
  } catch (error) {
    console.error("PayFast Wallet IPN error:", error)
    return NextResponse.json({ error: "IPN processing failed" }, { status: 500 })
  }
}

const generateSignature = (data: Record<string, string>, passPhrase: string | null = null) => {
  let pfOutput = ""
  for (let key in data) {
    if (data.hasOwnProperty(key) && key !== "signature") {
      const encoded = encodeURIComponent(data[key].trim())
        .replace(/%20/g, "+")
        .replace(/\(/g, "%28")
        .replace(/\)/g, "%29")
      pfOutput += `${key}=${encoded}&`
    }
  }

  let getString = pfOutput.slice(0, -1)
  if (passPhrase !== null) {
    const encodedPass = encodeURIComponent(passPhrase.trim())
      .replace(/%20/g, "+")
      .replace(/\(/g, "%28")
      .replace(/\)/g, "%29")
    getString += `&passphrase=${encodedPass}`
  }

  return crypto.createHash("md5").update(getString).digest("hex")
}

