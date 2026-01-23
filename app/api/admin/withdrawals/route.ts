import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { supabaseAdmin } from '@/utils/supabase/admin'
import { auditLog } from '@/lib/audit-logger'
import { verifyAdmin } from '@/lib/auth-utils'
import { cookies } from 'next/headers'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    // Get user from request cookies (authenticated session)
    const supabase = await createClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin status from admins table using admin client
    const adminInfo = await verifyAdmin(supabaseAdmin, user.id)
    if (!adminInfo.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Build query for withdrawal transactions using admin client
    let query = supabaseAdmin
      .from('wallet_transactions')
      .select(`
        id,
        wallet_id,
        amount,
        status,
        description,
        metadata,
        created_at,
        updated_at,
        user_wallets!inner (
          id,
          user_id,
          available_balance,
          pending_withdrawal_balance
        )
      `, { count: 'exact' })
      .eq('transaction_type', 'withdrawal')

    // Filter by status
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    // Apply pagination and ordering
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: withdrawals, error, count } = await query

    if (error) {
      logger.error('Error fetching withdrawals:', error)
      throw error
    }

    // Get user IDs from withdrawals to fetch profiles
    const userIds = [...new Set(withdrawals?.map(w => (w.user_wallets as any)?.user_id).filter(Boolean) || [])]
    
    // Fetch user profiles
    let userProfiles: Record<string, { full_name: string }> = {}
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id, full_name, first_name, last_name')
        .in('user_id', userIds)
      
      if (profiles) {
        userProfiles = profiles.reduce((acc, p) => {
          // Use full_name if available, otherwise combine first and last name
          const name = p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown'
          acc[p.user_id] = { full_name: name }
          return acc
        }, {} as Record<string, { full_name: string }>)
      }
    }

    // Get summary stats
    const { data: pendingStats } = await supabaseAdmin
      .from('wallet_transactions')
      .select('amount')
      .eq('transaction_type', 'withdrawal')
      .eq('status', 'pending')

    const pendingCount = pendingStats?.length || 0
    const pendingTotal = pendingStats?.reduce((sum, tx) => sum + Math.abs(parseFloat(tx.amount)), 0) || 0

    return NextResponse.json({
      withdrawals: withdrawals?.map(w => {
        const userWallet = w.user_wallets as any
        const userId = userWallet?.user_id
        const userProfile = userId ? userProfiles[userId] : null
        const metadata = w.metadata as any
        return {
          id: w.id,
          walletId: w.wallet_id,
          amount: Math.abs(parseFloat(w.amount as string)),
          status: w.status,
          description: w.description,
          metadata: w.metadata,
          createdAt: w.created_at,
          updatedAt: w.updated_at,
          user: {
            id: userId,
            name: userProfile?.full_name || metadata?.userName || 'Unknown',
            email: metadata?.userEmail || 'No email',
            availableBalance: parseFloat(userWallet?.available_balance) || 0,
            pendingWithdrawalBalance: parseFloat(userWallet?.pending_withdrawal_balance) || 0
          }
        }
      }) || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      },
      stats: {
        pendingCount,
        pendingTotal
      }
    })
  } catch (error) {
    logger.error('Error fetching withdrawals:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get user from request cookies (authenticated session)
    const supabase = await createClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin status from admins table using admin client
    const adminInfo = await verifyAdmin(supabaseAdmin, user.id)
    if (!adminInfo.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { transactionId, action, rejectionReason } = body

    if (!transactionId || !action) {
      return NextResponse.json({ error: 'Transaction ID and action are required' }, { status: 400 })
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be "approve" or "reject"' }, { status: 400 })
    }

    // Get the withdrawal transaction using admin client
    const { data: transaction, error: txError } = await supabaseAdmin
      .from('wallet_transactions')
      .select(`
        id,
        wallet_id,
        amount,
        status,
        metadata,
        user_wallets!inner (
          id,
          user_id,
          available_balance,
          pending_withdrawal_balance,
          total_withdrawn
        )
      `)
      .eq('id', transactionId)
      .eq('transaction_type', 'withdrawal')
      .single()

    if (txError || !transaction) {
      return NextResponse.json({ error: 'Withdrawal transaction not found' }, { status: 404 })
    }

    if (transaction.status !== 'pending') {
      return NextResponse.json({ 
        error: `Cannot ${action} a withdrawal that is already ${transaction.status}` 
      }, { status: 400 })
    }

    const wallet = transaction.user_wallets as any
    const withdrawalAmount = Math.abs(parseFloat(transaction.amount as string))

    if (action === 'approve') {
      // SECURITY FIX (VULN-007): Use atomic function to approve withdrawal
      const { data: approvalResult, error: approvalError } = await supabaseAdmin.rpc(
        'atomic_withdrawal_approve',
        {
          p_wallet_id: wallet.id,
          p_amount: withdrawalAmount,
          p_transaction_id: transactionId,
          p_admin_id: user.id
        }
      )

      if (approvalError) {
        logger.error('Error in atomic_withdrawal_approve:', approvalError)
        return NextResponse.json({ error: 'Failed to approve withdrawal' }, { status: 500 })
      }

      if (approvalResult === false) {
        const { data: updatedTx } = await supabaseAdmin
          .from('wallet_transactions')
          .select('status, metadata')
          .eq('id', transactionId)
          .single()

        if (updatedTx?.status === 'failed') {
          const metadata = updatedTx.metadata as any
          return NextResponse.json({ 
            error: metadata?.failure_reason || 'Insufficient balance',
            insufficientFunds: true,
            availableBalance: metadata?.available_balance,
            requestedAmount: metadata?.requested_amount
          }, { status: 400 })
        }

        return NextResponse.json({ 
          error: 'Withdrawal could not be approved',
        }, { status: 400 })
      }

      const { data: updatedWallet } = await supabaseAdmin
        .from('user_wallets')
        .select('available_balance, pending_withdrawal_balance')
        .eq('id', wallet.id)
        .single()

      await auditLog.wallet.withdrawalApproved(
        user.id,
        wallet.user_id,
        withdrawalAmount,
        transactionId,
        request
      )

      return NextResponse.json({
        success: true,
        message: 'Withdrawal approved successfully',
        transaction: {
          id: transactionId,
          status: 'completed',
          amount: withdrawalAmount,
          newBalance: parseFloat(updatedWallet?.available_balance) || 0,
          newPendingWithdrawalBalance: parseFloat(updatedWallet?.pending_withdrawal_balance) || 0
        }
      })

    } else {
      const { data: rejectionResult, error: rejectionError } = await supabaseAdmin.rpc(
        'atomic_withdrawal_reject',
        {
          p_transaction_id: transactionId,
          p_admin_id: user.id,
          p_rejection_reason: rejectionReason || 'Rejected by admin'
        }
      )

      if (rejectionError) {
        logger.error('Error in atomic_withdrawal_reject:', rejectionError)
        return NextResponse.json({ error: 'Failed to reject withdrawal' }, { status: 500 })
      }

      if (rejectionResult === false) {
        return NextResponse.json({ 
          error: 'Withdrawal was already processed',
        }, { status: 400 })
      }

      await auditLog.wallet.withdrawalRejected(
        user.id,
        wallet.user_id,
        withdrawalAmount,
        transactionId,
        rejectionReason || 'Rejected by admin',
        request
      )

      return NextResponse.json({
        success: true,
        message: 'Withdrawal rejected',
        transaction: {
          id: transactionId,
          status: 'failed',
          amount: withdrawalAmount,
          rejectionReason: rejectionReason || 'Rejected by admin'
        }
      })
    }
  } catch (error) {
    logger.error('Error processing withdrawal action:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
