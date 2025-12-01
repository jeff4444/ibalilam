'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/utils/supabase/client'
import {
  Users,
  Store,
  Package,
  ShoppingCart,
  CreditCard,
  Wallet,
  FileCheck,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  DollarSign,
  ArrowUpRight
} from 'lucide-react'

interface DashboardStats {
  users: {
    total: number
    newThisMonth: number
    sellers: number
    buyers: number
  }
  fica: {
    pending: number
    verified: number
    rejected: number
  }
  shops: {
    total: number
    active: number
    totalBalance: number
  }
  listings: {
    total: number
    active: number
    draft: number
    outOfStock: number
  }
  orders: {
    total: number
    pending: number
    processing: number
    shipped: number
    delivered: number
    cancelled: number
  }
  transactions: {
    total: number
    pending: number
    completed: number
    totalAmount: number
  }
  wallet: {
    availableBalance: number
    lockedBalance: number
    totalCommissions: number
    totalPayouts: number
  }
}

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon: React.ReactNode
  href: string
  trend?: {
    value: number
    isPositive: boolean
  }
  highlight?: boolean
  highlightColor?: 'green' | 'yellow' | 'red' | 'blue'
}

function StatCard({ title, value, description, icon, href, trend, highlight, highlightColor = 'green' }: StatCardProps) {
  const colorClasses = {
    green: 'border-emerald-500/50 bg-emerald-500/10',
    yellow: 'border-yellow-500/50 bg-yellow-500/10',
    red: 'border-red-500/50 bg-red-500/10',
    blue: 'border-blue-500/50 bg-blue-500/10'
  }

  return (
    <Link href={href}>
      <Card className={`bg-slate-900 border-slate-800 hover:border-slate-700 transition-all hover:shadow-lg hover:shadow-emerald-500/5 cursor-pointer group ${highlight ? colorClasses[highlightColor] : ''}`}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-slate-400">{title}</CardTitle>
          <div className="text-slate-500 group-hover:text-emerald-500 transition-colors">
            {icon}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-2xl font-bold text-white">{value}</div>
              {description && (
                <p className="text-xs text-slate-500 mt-1">{description}</p>
              )}
            </div>
            {trend && (
              <div className={`flex items-center gap-1 text-xs ${trend.isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                {trend.isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                <span>{trend.value}%</span>
              </div>
            )}
            <ArrowUpRight className="h-4 w-4 text-slate-600 group-hover:text-emerald-500 transition-colors" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function MiniStatCard({ title, value, icon, color }: { title: string, value: number | string, icon: React.ReactNode, color: string }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg ${color}`}>
      <div className="text-white/80">{icon}</div>
      <div>
        <p className="text-xs text-white/60">{title}</p>
        <p className="text-lg font-semibold text-white">{value}</p>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      setLoading(true)

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

      setStats({
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
      console.error('Error fetching stats:', error)
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

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-800 rounded w-48"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-32 bg-slate-800 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 mt-1">Welcome to the admin panel. Here's what's happening today.</p>
        </div>
      </div>

      {/* FICA Alert */}
      {stats && stats.fica.pending > 0 && (
        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardContent className="flex items-center gap-4 py-4">
            <AlertTriangle className="h-6 w-6 text-yellow-500" />
            <div>
              <p className="font-medium text-yellow-500">
                {stats.fica.pending} FICA {stats.fica.pending === 1 ? 'submission' : 'submissions'} awaiting review
              </p>
              <p className="text-sm text-yellow-500/70">Click here to review pending applications</p>
            </div>
            <Link href="/admin/fica-review" className="ml-auto">
              <ArrowUpRight className="h-5 w-5 text-yellow-500" />
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={stats?.users.total || 0}
          description={`${stats?.users.newThisMonth || 0} new this month`}
          icon={<Users className="h-5 w-5" />}
          href="/admin/users"
        />
        <StatCard
          title="Active Shops"
          value={stats?.shops.active || 0}
          description={`${stats?.shops.total || 0} total shops`}
          icon={<Store className="h-5 w-5" />}
          href="/admin/shops"
        />
        <StatCard
          title="Active Listings"
          value={stats?.listings.active || 0}
          description={`${stats?.listings.total || 0} total listings`}
          icon={<Package className="h-5 w-5" />}
          href="/admin/listings"
        />
        <StatCard
          title="Total Orders"
          value={stats?.orders.total || 0}
          description={`${stats?.orders.pending || 0} pending`}
          icon={<ShoppingCart className="h-5 w-5" />}
          href="/admin/orders"
        />
      </div>

      {/* Financial Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-slate-900 border-slate-800 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Wallet className="h-5 w-5 text-emerald-500" />
              Platform Wallet
            </CardTitle>
            <CardDescription className="text-slate-400">Financial overview</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MiniStatCard
              title="Available Balance"
              value={formatCurrency(stats?.wallet.availableBalance || 0)}
              icon={<DollarSign className="h-4 w-4" />}
              color="bg-emerald-500/20"
            />
            <MiniStatCard
              title="Locked (Escrow)"
              value={formatCurrency(stats?.wallet.lockedBalance || 0)}
              icon={<Clock className="h-4 w-4" />}
              color="bg-yellow-500/20"
            />
            <MiniStatCard
              title="Total Commissions"
              value={formatCurrency(stats?.wallet.totalCommissions || 0)}
              icon={<TrendingUp className="h-4 w-4" />}
              color="bg-blue-500/20"
            />
            <MiniStatCard
              title="Total Payouts"
              value={formatCurrency(stats?.wallet.totalPayouts || 0)}
              icon={<CreditCard className="h-4 w-4" />}
              color="bg-purple-500/20"
            />
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-emerald-500" />
              FICA Status
            </CardTitle>
            <CardDescription className="text-slate-400">Verification overview</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/admin/fica-review?status=pending" className="block">
              <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 transition-colors">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm text-slate-300">Pending</span>
                </div>
                <span className="font-semibold text-yellow-500">{stats?.fica.pending || 0}</span>
              </div>
            </Link>
            <Link href="/admin/fica-review?status=verified" className="block">
              <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm text-slate-300">Verified</span>
                </div>
                <span className="font-semibold text-emerald-500">{stats?.fica.verified || 0}</span>
              </div>
            </Link>
            <Link href="/admin/fica-review?status=rejected" className="block">
              <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-slate-300">Rejected</span>
                </div>
                <span className="font-semibold text-red-500">{stats?.fica.rejected || 0}</span>
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Order Status & Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-emerald-500" />
              Order Status
            </CardTitle>
            <CardDescription className="text-slate-400">Current order breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/admin/orders?status=pending">
                <div className="p-3 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors">
                  <p className="text-xs text-slate-400">Pending</p>
                  <p className="text-xl font-semibold text-yellow-500">{stats?.orders.pending || 0}</p>
                </div>
              </Link>
              <Link href="/admin/orders?status=processing">
                <div className="p-3 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors">
                  <p className="text-xs text-slate-400">Processing</p>
                  <p className="text-xl font-semibold text-blue-500">{stats?.orders.processing || 0}</p>
                </div>
              </Link>
              <Link href="/admin/orders?status=shipped">
                <div className="p-3 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors">
                  <p className="text-xs text-slate-400">Shipped</p>
                  <p className="text-xl font-semibold text-purple-500">{stats?.orders.shipped || 0}</p>
                </div>
              </Link>
              <Link href="/admin/orders?status=delivered">
                <div className="p-3 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors">
                  <p className="text-xs text-slate-400">Delivered</p>
                  <p className="text-xl font-semibold text-emerald-500">{stats?.orders.delivered || 0}</p>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-500" />
              Transactions
            </CardTitle>
            <CardDescription className="text-slate-400">Payment transactions overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Total Transactions</span>
                <span className="font-semibold text-white">{stats?.transactions.total || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Pending</span>
                <span className="font-semibold text-yellow-500">{stats?.transactions.pending || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Completed</span>
                <span className="font-semibold text-emerald-500">{stats?.transactions.completed || 0}</span>
              </div>
              <div className="border-t border-slate-700 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Total Volume</span>
                  <span className="font-bold text-xl text-white">{formatCurrency(stats?.transactions.totalAmount || 0)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Transactions"
          value={stats?.transactions.total || 0}
          description={formatCurrency(stats?.transactions.totalAmount || 0)}
          icon={<CreditCard className="h-5 w-5" />}
          href="/admin/transactions"
        />
        <StatCard
          title="Platform Wallet"
          value={formatCurrency(stats?.wallet.availableBalance || 0)}
          description="Available balance"
          icon={<Wallet className="h-5 w-5" />}
          href="/admin/wallet"
        />
        <StatCard
          title="FICA Pending"
          value={stats?.fica.pending || 0}
          description="Awaiting review"
          icon={<FileCheck className="h-5 w-5" />}
          href="/admin/fica-review"
          highlight={stats?.fica.pending ? stats.fica.pending > 0 : false}
          highlightColor="yellow"
        />
        <StatCard
          title="Analytics"
          value="View"
          description="Platform insights"
          icon={<TrendingUp className="h-5 w-5" />}
          href="/admin/analytics"
        />
      </div>
    </div>
  )
}
