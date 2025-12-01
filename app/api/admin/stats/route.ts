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

    // Fetch all stats in parallel
    const [
      usersResult,
      shopsResult,
      partsResult,
      ordersResult,
      transactionsResult,
      walletSettingsResult
    ] = await Promise.all([
      supabase.from('user_profiles').select('user_role, fica_status, created_at'),
      supabase.from('shops').select('is_active, locked_balance, available_balance'),
      supabase.from('parts').select('status'),
      supabase.from('orders').select('status, payment_status, total_amount'),
      supabase.from('transactions').select('status, amount'),
      supabase.from('global_settings').select('setting_key, setting_value').in('setting_key', [
        'platform_available_balance',
        'platform_locked_balance',
        'platform_total_commissions',
        'platform_total_payouts'
      ])
    ])

    const users = usersResult.data || []
    const shops = shopsResult.data || []
    const parts = partsResult.data || []
    const orders = ordersResult.data || []
    const transactions = transactionsResult.data || []
    const walletSettings = walletSettingsResult.data || []

    // Calculate this month's users
    const thisMonth = new Date()
    thisMonth.setDate(1)
    thisMonth.setHours(0, 0, 0, 0)
    const newUsersThisMonth = users.filter(u => new Date(u.created_at) >= thisMonth).length

    // Parse wallet settings
    const getWalletSetting = (key: string) => {
      const setting = walletSettings.find(s => s.setting_key === key)
      return parseFloat(setting?.setting_value || '0')
    }

    return NextResponse.json({
      users: {
        total: users.length,
        newThisMonth: newUsersThisMonth,
        sellers: users.filter(u => u.user_role === 'seller').length,
        buyers: users.filter(u => u.user_role === 'buyer').length
      },
      fica: {
        pending: users.filter(u => u.fica_status === 'pending').length,
        verified: users.filter(u => u.fica_status === 'verified').length,
        rejected: users.filter(u => u.fica_status === 'rejected').length
      },
      shops: {
        total: shops.length,
        active: shops.filter(s => s.is_active).length,
        totalBalance: shops.reduce((sum, s) => sum + (parseFloat(s.available_balance) || 0) + (parseFloat(s.locked_balance) || 0), 0)
      },
      listings: {
        total: parts.length,
        active: parts.filter(p => p.status === 'active').length,
        draft: parts.filter(p => p.status === 'draft').length,
        outOfStock: parts.filter(p => p.status === 'out_of_stock').length
      },
      orders: {
        total: orders.length,
        pending: orders.filter(o => o.status === 'pending').length,
        processing: orders.filter(o => o.status === 'processing').length,
        shipped: orders.filter(o => o.status === 'shipped').length,
        delivered: orders.filter(o => o.status === 'delivered').length,
        cancelled: orders.filter(o => o.status === 'cancelled').length
      },
      transactions: {
        total: transactions.length,
        pending: transactions.filter(t => t.status === 'pending').length,
        completed: transactions.filter(t => t.status === 'completed').length,
        totalAmount: transactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0)
      },
      wallet: {
        availableBalance: getWalletSetting('platform_available_balance'),
        lockedBalance: getWalletSetting('platform_locked_balance'),
        totalCommissions: getWalletSetting('platform_total_commissions'),
        totalPayouts: getWalletSetting('platform_total_payouts')
      }
    })
  } catch (error) {
    console.error('Error fetching admin stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

