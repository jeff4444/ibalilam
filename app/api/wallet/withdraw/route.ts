import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient(cookies())
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { amount, bankDetails } = body

    // Validate amount
    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    // Get global settings for withdrawal limits
    const { data: settings } = await supabase
      .from('global_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['min_withdrawal_amount', 'max_withdrawal_amount'])

    const getSettingValue = (key: string, defaultValue: string) => {
      const setting = settings?.find(s => s.setting_key === key)
      return parseFloat(setting?.setting_value || defaultValue)
    }

    const minWithdrawal = getSettingValue('min_withdrawal_amount', '100')
    const maxWithdrawal = getSettingValue('max_withdrawal_amount', '50000')

    if (amount < minWithdrawal) {
      return NextResponse.json({ 
        error: `Minimum withdrawal amount is R${minWithdrawal.toFixed(2)}` 
      }, { status: 400 })
    }

    if (amount > maxWithdrawal) {
      return NextResponse.json({ 
        error: `Maximum withdrawal amount is R${maxWithdrawal.toFixed(2)}` 
      }, { status: 400 })
    }

    // Get user's wallet
    const { data: wallet, error: walletError } = await supabase
      .from('user_wallets')
      .select('id, available_balance')
      .eq('user_id', user.id)
      .single()

    if (walletError || !wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
    }

    const availableBalance = parseFloat(wallet.available_balance) || 0
    if (availableBalance < amount) {
      return NextResponse.json({ 
        error: 'Insufficient balance',
        availableBalance 
      }, { status: 400 })
    }

    // Get user profile for bank details (if stored)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name, email')
      .eq('user_id', user.id)
      .single()

    // Create withdrawal transaction (pending status - balance NOT deducted yet)
    // Balance will only be deducted when admin approves the withdrawal
    const { data: transaction, error: txError } = await supabase
      .from('wallet_transactions')
      .insert({
        wallet_id: wallet.id,
        transaction_type: 'withdrawal',
        amount: -amount, // Negative for outgoing
        status: 'pending',
        reference_type: 'payout',
        description: `Withdrawal request of R${parseFloat(amount).toFixed(2)}`,
        balance_after: null, // Will be set when approved
        metadata: {
          bankDetails: bankDetails || null,
          userName: profile?.full_name || null,
          userEmail: profile?.email || user.email,
          requestedAmount: amount,
          availableBalanceAtRequest: availableBalance
        }
      })
      .select()
      .single()

    if (txError) {
      console.error('Error creating withdrawal transaction:', txError)
      return NextResponse.json({ error: 'Failed to process withdrawal' }, { status: 500 })
    }

    // NOTE: Balance is NOT deducted here
    // Admin will approve/reject the withdrawal request
    // On approval, balance will be deducted via admin API

    return NextResponse.json({
      success: true,
      message: 'Withdrawal request submitted successfully. It will be reviewed and processed within 1-3 business days.',
      transaction: {
        id: transaction.id,
        amount: parseFloat(transaction.amount),
        status: transaction.status,
        createdAt: transaction.created_at
      },
      currentBalance: availableBalance
    })
  } catch (error) {
    console.error('Error processing withdrawal:', error)
    return NextResponse.json({ error: 'Failed to process withdrawal' }, { status: 500 })
  }
}

// GET endpoint to check withdrawal status
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(cookies())
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const transactionId = searchParams.get('transactionId')

    if (!transactionId) {
      return NextResponse.json({ error: 'Transaction ID required' }, { status: 400 })
    }

    // Get the transaction
    const { data: transaction, error: txError } = await supabase
      .from('wallet_transactions')
      .select(`
        id,
        transaction_type,
        amount,
        status,
        description,
        created_at,
        updated_at,
        user_wallets!inner(user_id)
      `)
      .eq('id', transactionId)
      .eq('user_wallets.user_id', user.id)
      .single()

    if (txError || !transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    return NextResponse.json({
      transaction: {
        id: transaction.id,
        type: transaction.transaction_type,
        amount: parseFloat(transaction.amount as string),
        status: transaction.status,
        description: transaction.description,
        createdAt: transaction.created_at,
        updatedAt: transaction.updated_at
      }
    })
  } catch (error) {
    console.error('Error fetching withdrawal status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

