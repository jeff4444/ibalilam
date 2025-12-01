'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  BarChart3, 
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Users,
  ShoppingCart,
  DollarSign,
  Package,
  Eye
} from 'lucide-react'

interface DailyData {
  date: string
  users: number
  orders: number
  revenue: number
  commissions: number
}

interface CategoryBreakdown {
  category: string
  count: number
}

interface OrderStatusBreakdown {
  status: string
  count: number
}

interface AnalyticsData {
  period: number
  summary: {
    totalUsers: number
    totalOrders: number
    totalRevenue: number
    totalCommissions: number
    totalListings: number
    totalViews: number
    growth: {
      users: number
      orders: number
      revenue: number
    }
  }
  dailyData: DailyData[]
  categoryBreakdown: CategoryBreakdown[]
  orderStatusBreakdown: OrderStatusBreakdown[]
}

export default function AdminAnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30')

  useEffect(() => {
    fetchAnalytics()
  }, [period])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      
      const response = await fetch(`/api/admin/analytics?period=${period}`)
      const data = await response.json()
      
      if (response.ok) {
        setAnalytics(data)
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const getGrowthBadge = (growth: number) => {
    if (growth > 0) {
      return (
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
          <TrendingUp className="h-3 w-3 mr-1" />
          +{growth}%
        </Badge>
      )
    } else if (growth < 0) {
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
          <TrendingDown className="h-3 w-3 mr-1" />
          {growth}%
        </Badge>
      )
    }
    return (
      <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">
        0%
      </Badge>
    )
  }

  const getMaxValue = (data: DailyData[], key: keyof DailyData) => {
    return Math.max(...data.map(d => d[key] as number), 1)
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      mobile_phones: 'bg-blue-500',
      phone_parts: 'bg-emerald-500',
      phone_accessories: 'bg-purple-500',
      laptops: 'bg-orange-500',
      steam_kits: 'bg-pink-500',
      other_electronics: 'bg-slate-500'
    }
    return colors[category] || 'bg-slate-500'
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500',
      confirmed: 'bg-blue-500',
      processing: 'bg-indigo-500',
      shipped: 'bg-purple-500',
      delivered: 'bg-emerald-500',
      cancelled: 'bg-red-500',
      refunded: 'bg-slate-500'
    }
    return colors[status] || 'bg-slate-500'
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Analytics</h1>
          <p className="text-slate-400 mt-1">Platform performance and insights</p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-36 bg-slate-800 border-slate-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={fetchAnalytics} variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-400">New Users</p>
                <p className="text-3xl font-bold text-white mt-1">{analytics?.summary.totalUsers || 0}</p>
                <div className="mt-2">{getGrowthBadge(analytics?.summary.growth.users || 0)}</div>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-400">Orders</p>
                <p className="text-3xl font-bold text-white mt-1">{analytics?.summary.totalOrders || 0}</p>
                <div className="mt-2">{getGrowthBadge(analytics?.summary.growth.orders || 0)}</div>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-400">Revenue</p>
                <p className="text-3xl font-bold text-white mt-1">{formatCurrency(analytics?.summary.totalRevenue || 0)}</p>
                <div className="mt-2">{getGrowthBadge(analytics?.summary.growth.revenue || 0)}</div>
              </div>
              <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-400">Commissions</p>
                <p className="text-3xl font-bold text-white mt-1">{formatCurrency(analytics?.summary.totalCommissions || 0)}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Package className="h-8 w-8 text-slate-400" />
              <div>
                <p className="text-2xl font-bold text-white">{analytics?.summary.totalListings || 0}</p>
                <p className="text-sm text-slate-400">New Listings</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Eye className="h-8 w-8 text-slate-400" />
              <div>
                <p className="text-2xl font-bold text-white">{analytics?.summary.totalViews?.toLocaleString() || 0}</p>
                <p className="text-sm text-slate-400">Total Views</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Revenue Over Time</CardTitle>
            <CardDescription className="text-slate-400">Daily revenue for the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics?.dailyData && analytics.dailyData.length > 0 ? (
              <div className="h-64 flex items-end gap-1">
                {analytics.dailyData.map((day, idx) => {
                  const maxRevenue = getMaxValue(analytics.dailyData, 'revenue')
                  const height = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0
                  return (
                    <div
                      key={idx}
                      className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/40 transition-colors rounded-t relative group"
                      style={{ height: `${Math.max(height, 2)}%` }}
                    >
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        {formatCurrency(day.revenue)}
                        <br />
                        {new Date(day.date).toLocaleDateString()}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-500">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Orders Chart */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Orders Over Time</CardTitle>
            <CardDescription className="text-slate-400">Daily orders for the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics?.dailyData && analytics.dailyData.length > 0 ? (
              <div className="h-64 flex items-end gap-1">
                {analytics.dailyData.map((day, idx) => {
                  const maxOrders = getMaxValue(analytics.dailyData, 'orders')
                  const height = maxOrders > 0 ? (day.orders / maxOrders) * 100 : 0
                  return (
                    <div
                      key={idx}
                      className="flex-1 bg-blue-500/20 hover:bg-blue-500/40 transition-colors rounded-t relative group"
                      style={{ height: `${Math.max(height, 2)}%` }}
                    >
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        {day.orders} orders
                        <br />
                        {new Date(day.date).toLocaleDateString()}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-500">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Listings by Category</CardTitle>
            <CardDescription className="text-slate-400">Distribution of new listings</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics?.categoryBreakdown && analytics.categoryBreakdown.length > 0 ? (
              <div className="space-y-4">
                {analytics.categoryBreakdown.map((cat) => {
                  const total = analytics.categoryBreakdown.reduce((sum, c) => sum + c.count, 0)
                  const percentage = total > 0 ? (cat.count / total) * 100 : 0
                  return (
                    <div key={cat.category}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-slate-300 capitalize">{cat.category.replace('_', ' ')}</span>
                        <span className="text-sm text-slate-400">{cat.count} ({percentage.toFixed(1)}%)</span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getCategoryColor(cat.category)} transition-all`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500">No data available</div>
            )}
          </CardContent>
        </Card>

        {/* Order Status Breakdown */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Orders by Status</CardTitle>
            <CardDescription className="text-slate-400">Distribution of order statuses</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics?.orderStatusBreakdown && analytics.orderStatusBreakdown.length > 0 ? (
              <div className="space-y-4">
                {analytics.orderStatusBreakdown.map((stat) => {
                  const total = analytics.orderStatusBreakdown.reduce((sum, s) => sum + s.count, 0)
                  const percentage = total > 0 ? (stat.count / total) * 100 : 0
                  return (
                    <div key={stat.status}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-slate-300 capitalize">{stat.status}</span>
                        <span className="text-sm text-slate-400">{stat.count} ({percentage.toFixed(1)}%)</span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getStatusColor(stat.status)} transition-all`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500">No data available</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Users Chart */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">New Users Over Time</CardTitle>
          <CardDescription className="text-slate-400">Daily user registrations for the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          {analytics?.dailyData && analytics.dailyData.length > 0 ? (
            <div className="h-48 flex items-end gap-1">
              {analytics.dailyData.map((day, idx) => {
                const maxUsers = getMaxValue(analytics.dailyData, 'users')
                const height = maxUsers > 0 ? (day.users / maxUsers) * 100 : 0
                return (
                  <div
                    key={idx}
                    className="flex-1 bg-purple-500/20 hover:bg-purple-500/40 transition-colors rounded-t relative group"
                    style={{ height: `${Math.max(height, 2)}%` }}
                  >
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      {day.users} users
                      <br />
                      {new Date(day.date).toLocaleDateString()}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-500">
              No data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

