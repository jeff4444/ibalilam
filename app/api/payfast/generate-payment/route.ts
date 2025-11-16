import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { amount, itemName, email, firstName, lastName } = body

    // Validate required fields
    if (!amount || !itemName || !email) {
      return NextResponse.json(
        { error: "Missing required fields: amount, itemName, email" },
        { status: 400 }
      )
    }

    // Get environment variables
    const merchantId = process.env.MERCHANT_ID
    const merchantKey = process.env.MERCHANT_KEY
    const passphrase = process.env.PAYFAST_PASSPHRASE
    const payfastUrl = process.env.PAYFAST_URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL

    if (!merchantId || !merchantKey || !passphrase || !payfastUrl || !baseUrl) {
      return NextResponse.json(
        { error: "PayFast credentials not configured" },
        { status: 500 }
      )
    }

    // Build PayFast data object
    const payfastData: Record<string, string> = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: `${baseUrl}/payment/success`,
      cancel_url: `${baseUrl}/payment/cancelled`,
      notify_url: `${baseUrl}/api/payfast/notify`,
      name_first: firstName || "",
      name_last: lastName || "",
      email_address: email,
      amount: parseFloat(amount).toFixed(2),
      item_name: itemName,
    }

    console.log("PayFast data:", payfastData)

    // Generate signature
    const signature = generateSignature(payfastData, passphrase)
    payfastData.signature = signature

    return NextResponse.json({
      payfastUrl,
      payfastData,
    })
  } catch (error) {
    console.error("PayFast payment generation error:", error)
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
}; 

