import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(cookies())
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const transactionType = searchParams.get('type') || ''
    const offset = (page - 1) * limit

    // Get or create wallet
    const { data: wallet, error: walletError } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // If wallet doesn't exist, create one
    let userWallet = wallet
    if (walletError && walletError.code === 'PGRST116') {
      const { data: newWallet, error: createError } = await supabase
        .from('user_wallets')
        .insert({ user_id: user.id })
        .select()
        .single()
      
      if (createError) {
        logger.error('Error creating wallet:', createError)
        return NextResponse.json({ error: 'Failed to create wallet' }, { status: 500 })
      }
      userWallet = newWallet
    } else if (walletError) {
      logger.error('Error fetching wallet:', walletError)
      return NextResponse.json({ error: 'Failed to fetch wallet' }, { status: 500 })
    }

    // Build transactions query
    let transactionsQuery = supabase
      .from('wallet_transactions')
      .select('*', { count: 'exact' })
      .eq('wallet_id', userWallet.id)

    // Filter by type if specified
    if (transactionType && transactionType !== 'all') {
      transactionsQuery = transactionsQuery.eq('transaction_type', transactionType)
    }

    // Apply pagination and ordering
    transactionsQuery = transactionsQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: transactions, error: txError, count } = await transactionsQuery

    if (txError) {
      logger.error('Error fetching transactions:', txError)
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
    }

    // Get global settings for withdrawal limits
    const { data: settings } = await supabase
      .from('global_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['min_withdrawal_amount', 'max_withdrawal_amount', 'escrow_auto_release_days'])

    const getSettingValue = (key: string, defaultValue: string) => {
      const setting = settings?.find(s => s.setting_key === key)
      return parseFloat(setting?.setting_value || defaultValue)
    }

    return NextResponse.json({
      wallet: {
        id: userWallet.id,
        availableBalance: parseFloat(userWallet.available_balance) || 0,
        lockedBalance: parseFloat(userWallet.locked_balance) || 0,
        pendingWithdrawalBalance: parseFloat(userWallet.pending_withdrawal_balance) || 0,
        totalBalance: (parseFloat(userWallet.available_balance) || 0) + 
                      (parseFloat(userWallet.locked_balance) || 0) + 
                      (parseFloat(userWallet.pending_withdrawal_balance) || 0),
        totalDeposited: parseFloat(userWallet.total_deposited) || 0,
        totalWithdrawn: parseFloat(userWallet.total_withdrawn) || 0,
        createdAt: userWallet.created_at,
        updatedAt: userWallet.updated_at
      },
      transactions: transactions?.map(tx => ({
        id: tx.id,
        type: tx.transaction_type,
        amount: parseFloat(tx.amount) || 0,
        status: tx.status,
        referenceId: tx.reference_id,
        referenceType: tx.reference_type,
        description: tx.description,
        balanceAfter: parseFloat(tx.balance_after) || 0,
        payfastPaymentId: tx.payfast_payment_id,
        createdAt: tx.created_at
      })) || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      },
      settings: {
        minWithdrawalAmount: getSettingValue('min_withdrawal_amount', '100'),
        maxWithdrawalAmount: getSettingValue('max_withdrawal_amount', '50000'),
        escrowAutoReleaseDays: getSettingValue('escrow_auto_release_days', '7')
      }
    })
  } catch (error) {
    logger.error('Error in wallet GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

