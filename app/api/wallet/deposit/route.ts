import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { supabaseAdmin } from '@/utils/supabase/admin'
import { cookies } from 'next/headers'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    // Use regular client for auth and reads
    const supabase = await createClient(cookies())
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { amount } = body

    // Validate amount
    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    // Minimum deposit amount
    if (amount < 10) {
      return NextResponse.json({ error: 'Minimum deposit amount is R10' }, { status: 400 })
    }

    // Maximum deposit amount - prevent overflow (VULN-008 fix)
    // Max single deposit: R100 billion (well below DECIMAL(18,2) limit)
    const MAX_DEPOSIT_AMOUNT = 100000000000 // R100 billion
    if (amount > MAX_DEPOSIT_AMOUNT) {
      return NextResponse.json({ 
        error: `Maximum deposit amount is R${MAX_DEPOSIT_AMOUNT.toLocaleString()}` 
      }, { status: 400 })
    }

    // Get user profile for name and email
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name, email')
      .eq('user_id', user.id)
      .single()

    // Get or create wallet to ensure it exists
    let { data: wallet } = await supabase
      .from('user_wallets')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!wallet) {
      const { data: newWallet, error: createError } = await supabase
        .from('user_wallets')
        .insert({ user_id: user.id })
        .select('id')
        .single()
      
      if (createError) {
        console.error('Error creating wallet:', createError)
        return NextResponse.json({ error: 'Failed to create wallet' }, { status: 500 })
      }
      wallet = newWallet
    }

    // Create a pending transaction record
    // Use admin client since INSERT policy was removed for security (VULN-005)
    const { data: pendingTx, error: txError } = await supabaseAdmin
      .from('wallet_transactions')
      .insert({
        wallet_id: wallet.id,
        transaction_type: 'deposit',
        amount: amount,
        status: 'pending',
        reference_type: 'payfast',
        description: `Wallet deposit of R${parseFloat(amount).toFixed(2)}`
      })
      .select('id')
      .single()

    if (txError) {
      console.error('Error creating pending transaction:', txError)
      return NextResponse.json({ error: 'Failed to initiate deposit' }, { status: 500 })
    }

    // Get PayFast configuration
    const merchantId = process.env.MERCHANT_ID
    const merchantKey = process.env.MERCHANT_KEY
    const passphrase = process.env.PAYFAST_PASSPHRASE
    const payfastUrl = process.env.PAYFAST_URL
    // VULN-023 FIX: Standardize on NEXT_PUBLIC_APP_URL with fallbacks
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL

    if (!merchantId || !merchantKey || !passphrase || !payfastUrl || !baseUrl) {
      console.error('PayFast configuration missing:', {
        merchantId: !!merchantId,
        merchantKey: !!merchantKey,
        passphrase: !!passphrase,
        payfastUrl: !!payfastUrl,
        baseUrl: !!baseUrl
      })
      return NextResponse.json({ error: 'PayFast not configured' }, { status: 500 })
    }

    // Parse name
    const fullName = profile?.full_name || user.email?.split('@')[0] || 'User'
    const nameParts = fullName.split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''

    // Build PayFast data
    const payfastData: Record<string, string> = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: `${baseUrl}/wallet?deposit=success`,
      cancel_url: `${baseUrl}/wallet?deposit=cancelled`,
      notify_url: `${baseUrl}/api/payfast/wallet-notify`,
      name_first: firstName,
      name_last: lastName,
      email_address: profile?.email || user.email || '',
      amount: parseFloat(amount).toFixed(2),
      item_name: 'Wallet Deposit',
      custom_str1: user.id, // User ID for callback
      custom_str2: pendingTx.id, // Transaction ID for callback
      custom_str3: 'wallet_deposit' // Transaction type identifier
    }

    // Generate signature
    const signature = generateSignature(payfastData, passphrase)
    payfastData.signature = signature

    return NextResponse.json({
      payfastUrl,
      payfastData,
      transactionId: pendingTx.id
    })
  } catch (error) {
    console.error('Error initiating deposit:', error)
    return NextResponse.json({ error: 'Failed to initiate deposit' }, { status: 500 })
  }
}

const generateSignature = (data: Record<string, string>, passPhrase: string | null = null) => {
  let pfOutput = ""
  for (let key in data) {
    if (data.hasOwnProperty(key)) {
      if (data[key] !== "") {
        const encoded = encodeURIComponent(data[key].trim())
          .replace(/%20/g, "+")
          .replace(/\(/g, "%28")
          .replace(/\)/g, "%29")
        pfOutput += `${key}=${encoded}&`
      }
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

