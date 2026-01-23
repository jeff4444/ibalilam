import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { supabaseAdmin } from '@/utils/supabase/admin'
import { cookies } from 'next/headers'
import { auditLog } from '@/lib/audit-logger'
import { withRateLimit } from '@/lib/rate-limit-middleware'
import { logger } from '@/lib/logger'

// LOW-002 FIX: Bank details validation interface and function
interface BankDetails {
  accountNumber: string
  accountHolder: string
  bankName: string
  branchCode?: string
}

/**
 * Validates South African bank details
 * Returns sanitized bank details or null if invalid
 */
function validateBankDetails(details: unknown): BankDetails | null {
  if (!details || typeof details !== 'object') return null
  
  const { accountNumber, accountHolder, bankName, branchCode } = details as Record<string, unknown>
  
  // Required fields must be strings
  if (!accountNumber || typeof accountNumber !== 'string') return null
  if (!accountHolder || typeof accountHolder !== 'string') return null
  if (!bankName || typeof bankName !== 'string') return null
  
  // SA bank accounts: typically 10-12 digits (some banks allow 9-13)
  const cleanedAccountNumber = accountNumber.replace(/\s/g, '')
  if (!/^\d{9,13}$/.test(cleanedAccountNumber)) return null
  
  // Account holder: 2-100 chars, letters/spaces/hyphens/apostrophes only
  const cleanedHolder = accountHolder.trim()
  if (cleanedHolder.length < 2 || cleanedHolder.length > 100) return null
  if (!/^[a-zA-Z\s\-']+$/.test(cleanedHolder)) return null
  
  // Bank name: must be non-empty (2+ chars)
  const cleanedBankName = bankName.trim()
  if (cleanedBankName.length < 2) return null
  
  // Branch code: optional, but if provided must be 6 digits (universal branch codes in SA)
  let cleanedBranchCode: string | undefined
  if (branchCode) {
    if (typeof branchCode !== 'string') return null
    cleanedBranchCode = branchCode.replace(/\s/g, '')
    if (!/^\d{6}$/.test(cleanedBranchCode)) return null
  }
  
  return {
    accountNumber: cleanedAccountNumber,
    accountHolder: cleanedHolder,
    bankName: cleanedBankName,
    branchCode: cleanedBranchCode
  }
}

export async function POST(request: NextRequest) {
  try {
    // Use regular client for auth and reads
    const supabase = await createClient(cookies())
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // INFO-001 FIX: Rate limit withdrawal requests (use api_general as a reasonable limit)
    const rateLimitResponse = await withRateLimit(request, 'api_general', user.id)
    if (rateLimitResponse) return rateLimitResponse

    const body = await request.json()
    const { amount, bankDetails } = body

    // LOW-002 FIX: Validate bank details if provided
    let validatedBankDetails: BankDetails | null = null
    if (bankDetails) {
      validatedBankDetails = validateBankDetails(bankDetails)
      if (!validatedBankDetails) {
        return NextResponse.json({ 
          error: 'Invalid bank details. Please check account number (9-13 digits), account holder name (letters only), bank name, and branch code (6 digits if provided).' 
        }, { status: 400 })
      }
    }

    // Validate amount
    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    // Maximum withdrawal amount - prevent overflow (VULN-008 fix)
    // Max single withdrawal: R100 billion (well below DECIMAL(18,2) limit)
    const MAX_WITHDRAWAL_AMOUNT = 100000000000 // R100 billion
    if (amount > MAX_WITHDRAWAL_AMOUNT) {
      return NextResponse.json({ 
        error: `Maximum withdrawal amount is R${MAX_WITHDRAWAL_AMOUNT.toLocaleString()}` 
      }, { status: 400 })
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
      .select('id, available_balance, pending_withdrawal_balance')
      .eq('user_id', user.id)
      .single()

    if (walletError || !wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
    }

    const availableBalance = parseFloat(wallet.available_balance) || 0
    
    // Pre-check balance (atomic function will also verify, but this gives better UX)
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

    // SECURITY FIX (VULN-009): Use atomic function to request withdrawal
    // This atomically moves funds from available_balance to pending_withdrawal_balance
    // preventing double-spending while the withdrawal awaits admin approval
    const { data: result, error: withdrawalError } = await supabaseAdmin.rpc(
      'atomic_withdrawal_request',
      {
        p_wallet_id: wallet.id,
        p_amount: amount,
        p_user_id: user.id,
        p_bank_details: validatedBankDetails,
        p_user_name: profile?.full_name || null,
        p_user_email: profile?.email || user.email
      }
    )

    if (withdrawalError) {
      logger.error('Error in atomic_withdrawal_request:', withdrawalError)
      return NextResponse.json({ error: 'Failed to process withdrawal' }, { status: 500 })
    }

    // The function returns a table with one row
    const withdrawalResult = Array.isArray(result) ? result[0] : result

    if (!withdrawalResult?.success) {
      // Atomic function returned failure
      return NextResponse.json({ 
        error: withdrawalResult?.error_message || 'Failed to process withdrawal',
        availableBalance: parseFloat(withdrawalResult?.available_balance) || availableBalance
      }, { status: 400 })
    }

    // Withdrawal request successful - funds are now locked in pending_withdrawal_balance
    // INFO-004 FIX: Log successful withdrawal request
    await auditLog.wallet.withdrawalRequest(
      user.id,
      amount,
      withdrawalResult.transaction_id,
      request
    )

    return NextResponse.json({
      success: true,
      message: 'Withdrawal request submitted successfully. Funds have been reserved and will be released within 1-3 business days after approval.',
      transaction: {
        id: withdrawalResult.transaction_id,
        amount: -amount,
        status: 'pending',
        createdAt: new Date().toISOString()
      },
      // Return updated balances
      availableBalance: parseFloat(withdrawalResult.available_balance) || 0,
      pendingWithdrawalBalance: parseFloat(withdrawalResult.pending_withdrawal_balance) || 0
    })
  } catch (error) {
    logger.error('Error processing withdrawal:', error)
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
    logger.error('Error fetching withdrawal status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

