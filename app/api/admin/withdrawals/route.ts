import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(cookies(), true)
    
    // Verify admin status
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Build query for withdrawal transactions
    let query = supabase
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
          available_balance
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
      console.error('Error fetching withdrawals:', error)
      throw error
    }

    // Get user IDs from withdrawals to fetch profiles
    const userIds = [...new Set(withdrawals?.map(w => (w.user_wallets as any)?.user_id).filter(Boolean) || [])]
    
    // Fetch user profiles
    let userProfiles: Record<string, { full_name: string }> = {}
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
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
    const { data: pendingStats } = await supabase
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
            availableBalance: parseFloat(userWallet?.available_balance) || 0
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
    console.error('Error fetching withdrawals:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient(cookies(), true)
    
    // Verify admin status
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .single()

    if (!profile?.is_admin) {
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

    // Get the withdrawal transaction
    const { data: transaction, error: txError } = await supabase
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
    const currentBalance = parseFloat(wallet.available_balance) || 0
    const currentTotalWithdrawn = parseFloat(wallet.total_withdrawn) || 0

    if (action === 'approve') {
      // Check if user still has sufficient balance
      if (currentBalance < withdrawalAmount) {
        return NextResponse.json({ 
          error: `Insufficient balance. User has R${currentBalance.toFixed(2)} but withdrawal is R${withdrawalAmount.toFixed(2)}`,
          insufficientFunds: true,
          availableBalance: currentBalance,
          requestedAmount: withdrawalAmount
        }, { status: 400 })
      }

      // Calculate new balance
      const newBalance = currentBalance - withdrawalAmount
      const newTotalWithdrawn = currentTotalWithdrawn + withdrawalAmount

      // Update wallet balance
      const { error: walletError } = await supabase
        .from('user_wallets')
        .update({
          available_balance: newBalance,
          total_withdrawn: newTotalWithdrawn,
          updated_at: new Date().toISOString()
        })
        .eq('id', wallet.id)

      if (walletError) {
        console.error('Error updating wallet balance:', walletError)
        return NextResponse.json({ error: 'Failed to update wallet balance' }, { status: 500 })
      }

      // Update transaction status to completed
      const { error: updateError } = await supabase
        .from('wallet_transactions')
        .update({
          status: 'completed',
          balance_after: newBalance,
          metadata: {
            ...((transaction.metadata as object) || {}),
            approvedBy: user.id,
            approvedAt: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', transactionId)

      if (updateError) {
        // Try to rollback wallet balance
        await supabase
          .from('user_wallets')
          .update({
            available_balance: currentBalance,
            total_withdrawn: currentTotalWithdrawn,
            updated_at: new Date().toISOString()
          })
          .eq('id', wallet.id)

        console.error('Error updating transaction:', updateError)
        return NextResponse.json({ error: 'Failed to approve withdrawal' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'Withdrawal approved successfully',
        transaction: {
          id: transactionId,
          status: 'completed',
          amount: withdrawalAmount,
          newBalance
        }
      })

    } else {
      // Reject the withdrawal - no balance change needed
      const { error: updateError } = await supabase
        .from('wallet_transactions')
        .update({
          status: 'failed',
          metadata: {
            ...((transaction.metadata as object) || {}),
            rejectedBy: user.id,
            rejectedAt: new Date().toISOString(),
            rejectionReason: rejectionReason || 'Rejected by admin'
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', transactionId)

      if (updateError) {
        console.error('Error rejecting withdrawal:', updateError)
        return NextResponse.json({ error: 'Failed to reject withdrawal' }, { status: 500 })
      }

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
    console.error('Error processing withdrawal action:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

