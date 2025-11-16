import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const data: Record<string, string> = {}

    // Convert FormData to object
    formData.forEach((value, key) => {
      data[key] = value.toString()
    })

    console.log("PayFast IPN received:", data)

    // Validate signature
    const signature = data.signature
    delete data.signature

    const passphrase = process.env.PAYFAST_PASSPHRASE
    const generatedSignature = generateSignature(data, passphrase)

    if (signature !== generatedSignature) {
      console.error("PayFast IPN: Invalid signature")
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }

    // Verify payment status
    const paymentStatus = data.payment_status
    const merchantId = data.merchant_id
    const amount = data.amount_gross
    const itemName = data.item_name

    // Verify merchant_id matches
    if (merchantId !== process.env.MERCHANT_ID) {
      console.error("PayFast IPN: Invalid merchant ID")
      return NextResponse.json({ error: "Invalid merchant ID" }, { status: 400 })
    }

    // Process the payment based on status
    switch (paymentStatus) {
      case "COMPLETE":
        console.log(`Payment successful for ${itemName}: R${amount}`)
        // TODO: Update your database with the successful payment
        // You might want to:
        // 1. Mark the order as paid
        // 2. Send confirmation email
        // 3. Clear the user's cart
        // 4. Create order record
        break

      case "FAILED":
        console.log(`Payment failed for ${itemName}`)
        // TODO: Handle failed payment
        break

      case "PENDING":
        console.log(`Payment pending for ${itemName}`)
        // TODO: Handle pending payment
        break

      default:
        console.log(`Unknown payment status: ${paymentStatus}`)
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
}; 