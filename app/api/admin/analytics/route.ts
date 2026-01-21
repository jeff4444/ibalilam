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
    const period = searchParams.get('period') || '30' // days

    const daysAgo = parseInt(period)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysAgo)
    startDate.setHours(0, 0, 0, 0)

    // Fetch data for the period using admin client
    const [
      usersResult,
      ordersResult,
      transactionsResult,
      partsResult
    ] = await Promise.all([
      supabaseAdmin
        .from('user_profiles')
        .select('created_at')
        .gte('created_at', startDate.toISOString()),
      supabaseAdmin
        .from('orders')
        .select('created_at, status, total_amount, payment_status')
        .gte('created_at', startDate.toISOString()),
      supabaseAdmin
        .from('transactions')
        .select('created_at, amount, commission_amount, status')
        .gte('created_at', startDate.toISOString()),
      supabaseAdmin
        .from('parts')
        .select('created_at, status, category, views')
        .gte('created_at', startDate.toISOString())
    ])

    const users = usersResult.data || []
    const orders = ordersResult.data || []
    const transactions = transactionsResult.data || []
    const parts = partsResult.data || []

    // Generate daily data
    const dailyData: { 
      date: string
      users: number
      orders: number
      revenue: number
      commissions: number
    }[] = []

    for (let i = daysAgo; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      
      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)

      const dayUsers = users.filter(u => {
        const created = new Date(u.created_at)
        return created >= date && created < nextDate
      }).length

      const dayOrders = orders.filter(o => {
        const created = new Date(o.created_at)
        return created >= date && created < nextDate
      })

      const dayRevenue = dayOrders
        .filter(o => o.payment_status === 'paid')
        .reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0)

      const dayCommissions = transactions
        .filter(t => {
          const created = new Date(t.created_at)
          return created >= date && created < nextDate && t.status === 'completed'
        })
        .reduce((sum, t) => sum + (parseFloat(t.commission_amount) || 0), 0)

      dailyData.push({
        date: date.toISOString().split('T')[0],
        users: dayUsers,
        orders: dayOrders.length,
        revenue: dayRevenue,
        commissions: dayCommissions
      })
    }

    // Calculate category breakdown
    const categoryBreakdown = parts.reduce((acc: Record<string, number>, part) => {
      const category = part.category || 'other'
      acc[category] = (acc[category] || 0) + 1
      return acc
    }, {})

    // Calculate order status breakdown
    const orderStatusBreakdown = orders.reduce((acc: Record<string, number>, order) => {
      const status = order.status || 'unknown'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {})

    // Calculate totals
    const totalRevenue = orders
      .filter(o => o.payment_status === 'paid')
      .reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0)

    const totalCommissions = transactions
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + (parseFloat(t.commission_amount) || 0), 0)

    const totalViews = parts.reduce((sum, p) => sum + (p.views || 0), 0)

    // Calculate growth rates (compare to previous period)
    const previousStartDate = new Date(startDate)
    previousStartDate.setDate(previousStartDate.getDate() - daysAgo)

    const [prevUsersResult, prevOrdersResult] = await Promise.all([
      supabaseAdmin
        .from('user_profiles')
        .select('created_at')
        .gte('created_at', previousStartDate.toISOString())
        .lt('created_at', startDate.toISOString()),
      supabaseAdmin
        .from('orders')
        .select('total_amount, payment_status')
        .gte('created_at', previousStartDate.toISOString())
        .lt('created_at', startDate.toISOString())
    ])

    const prevUsers = prevUsersResult.data?.length || 0
    const prevOrders = prevOrdersResult.data?.length || 0
    const prevRevenue = (prevOrdersResult.data || [])
      .filter(o => o.payment_status === 'paid')
      .reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0)

    const userGrowth = prevUsers > 0 ? ((users.length - prevUsers) / prevUsers) * 100 : 0
    const orderGrowth = prevOrders > 0 ? ((orders.length - prevOrders) / prevOrders) * 100 : 0
    const revenueGrowth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0

    return NextResponse.json({
      period: daysAgo,
      summary: {
        totalUsers: users.length,
        totalOrders: orders.length,
        totalRevenue,
        totalCommissions,
        totalListings: parts.length,
        totalViews,
        growth: {
          users: Math.round(userGrowth * 10) / 10,
          orders: Math.round(orderGrowth * 10) / 10,
          revenue: Math.round(revenueGrowth * 10) / 10
        }
      },
      dailyData,
      categoryBreakdown: Object.entries(categoryBreakdown).map(([category, count]) => ({
        category,
        count
      })),
      orderStatusBreakdown: Object.entries(orderStatusBreakdown).map(([status, count]) => ({
        status,
        count
      }))
    })
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
