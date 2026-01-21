import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { supabaseAdmin } from '@/utils/supabase/admin'
import { verifyAdmin } from '@/lib/auth-utils'
import { cookies } from 'next/headers'

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
    const type = searchParams.get('type') || ''
    const status = searchParams.get('status') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Fetch wallet balance settings using admin client
    const { data: walletSettings } = await supabaseAdmin
      .from('global_settings')
      .select('setting_key, setting_value')
      .in('setting_key', [
        'platform_available_balance',
        'platform_locked_balance',
        'platform_total_commissions',
        'platform_total_payouts'
      ])

    const getWalletSetting = (key: string) => {
      const setting = walletSettings?.find(s => s.setting_key === key)
      return parseFloat(setting?.setting_value || '0')
    }

    // Build query for wallet transactions using admin client
    let query = supabaseAdmin
      .from('admin_wallet_transactions')
      .select(`
        *,
        shops!admin_wallet_transactions_payout_to_shop_id_fkey (
          name
        )
      `, { count: 'exact' })

    // Apply type filter
    if (type && type !== 'all') {
      query = query.eq('transaction_type', type)
    }

    // Apply status filter
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    // Apply pagination and ordering
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: transactions, error, count } = await query

    if (error) throw error

    // Fetch shops with balances for payout management
    const { data: shopsWithBalance } = await supabaseAdmin
      .from('shops')
      .select('id, name, available_balance, locked_balance')
      .gt('available_balance', 0)
      .order('available_balance', { ascending: false })

    return NextResponse.json({
      wallet: {
        availableBalance: getWalletSetting('platform_available_balance'),
        lockedBalance: getWalletSetting('platform_locked_balance'),
        totalCommissions: getWalletSetting('platform_total_commissions'),
        totalPayouts: getWalletSetting('platform_total_payouts')
      },
      transactions: transactions?.map(tx => ({
        id: tx.id,
        transaction_type: tx.transaction_type,
        amount: parseFloat(tx.amount) || 0,
        reference_id: tx.reference_id,
        reference_type: tx.reference_type,
        description: tx.description,
        status: tx.status,
        payout_to_shop_id: tx.payout_to_shop_id,
        payout_method: tx.payout_method,
        payout_reference: tx.payout_reference,
        balance_after: parseFloat(tx.balance_after) || 0,
        created_at: tx.created_at,
        shop_name: tx.shops?.name
      })) || [],
      shopsWithBalance: shopsWithBalance?.map(shop => ({
        id: shop.id,
        name: shop.name,
        available_balance: parseFloat(shop.available_balance) || 0,
        locked_balance: parseFloat(shop.locked_balance) || 0
      })) || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching wallet data:', error)
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
    const { action, shop_id, amount, method, reference, description } = body

    if (action === 'payout') {
      if (!shop_id || !amount) {
        return NextResponse.json({ error: 'shop_id and amount are required' }, { status: 400 })
      }

      // Verify shop has sufficient balance
      const { data: shop } = await supabaseAdmin
        .from('shops')
        .select('available_balance, name')
        .eq('id', shop_id)
        .single()

      if (!shop) {
        return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
      }

      if (parseFloat(shop.available_balance) < amount) {
        return NextResponse.json({ error: 'Insufficient shop balance' }, { status: 400 })
      }

      // Record the payout
      const { data: tx, error: txError } = await supabaseAdmin
        .from('admin_wallet_transactions')
        .insert({
          transaction_type: 'payout',
          amount: -amount,
          reference_id: shop_id,
          reference_type: 'shop',
          description: description || `Payout to ${shop.name}`,
          payout_to_shop_id: shop_id,
          payout_method: method || 'bank_transfer',
          payout_reference: reference,
          created_by: user.id,
          status: 'completed'
        })
        .select()
        .single()

      if (txError) throw txError

      // Deduct from shop balance
      const { error: shopError } = await supabaseAdmin
        .from('shops')
        .update({ 
          available_balance: parseFloat(shop.available_balance) - amount,
          updated_at: new Date().toISOString()
        })
        .eq('id', shop_id)

      if (shopError) throw shopError

      // Update total payouts
      const { data: currentPayouts } = await supabaseAdmin
        .from('global_settings')
        .select('setting_value')
        .eq('setting_key', 'platform_total_payouts')
        .single()

      await supabaseAdmin
        .from('global_settings')
        .update({ 
          setting_value: (parseFloat(currentPayouts?.setting_value || '0') + amount).toString(),
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', 'platform_total_payouts')

      return NextResponse.json({ success: true, transaction: tx })
    } else if (action === 'adjustment') {
      if (!amount || !description) {
        return NextResponse.json({ error: 'amount and description are required' }, { status: 400 })
      }

      // Get current balance
      const { data: currentBalance } = await supabaseAdmin
        .from('global_settings')
        .select('setting_value')
        .eq('setting_key', 'platform_available_balance')
        .single()

      const newBalance = parseFloat(currentBalance?.setting_value || '0') + amount

      // Record the adjustment
      const { data: tx, error: txError } = await supabaseAdmin
        .from('admin_wallet_transactions')
        .insert({
          transaction_type: 'adjustment',
          amount: amount,
          reference_type: 'manual',
          description: description,
          balance_after: newBalance,
          created_by: user.id,
          status: 'completed'
        })
        .select()
        .single()

      if (txError) throw txError

      // Update platform balance
      await supabaseAdmin
        .from('global_settings')
        .update({ 
          setting_value: newBalance.toString(),
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', 'platform_available_balance')

      return NextResponse.json({ success: true, transaction: tx })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error processing wallet action:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
