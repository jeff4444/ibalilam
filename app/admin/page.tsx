'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Users, FileText, CheckCircle, Clock, XCircle, AlertCircle, Home, Package, CreditCard, Settings } from 'lucide-react'
import Link from 'next/link'

interface AdminStats {
  totalUsers: number
  pendingFica: number
  verifiedFica: number
  rejectedFica: number
  totalListings: number
  activeListings: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    pendingFica: 0,
    verifiedFica: 0,
    rejectedFica: 0,
    totalListings: 0,
    activeListings: 0,
  })
  const [loading, setLoading] = useState(true)
  const [adminCheckComplete, setAdminCheckComplete] = useState(false)
  
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        router.push('/login')
        return
      }

      try {
        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select('user_role, is_admin')
          .eq('user_id', user.id)
          .single()

        if (error || !profile || !profile.is_admin) {
          setAdminCheckComplete(true)
          router.push('/dashboard')
          return
        }

        setAdminCheckComplete(true)
        fetchStats()
      } catch (error) {
        console.error('Error checking admin status:', error)
        setAdminCheckComplete(true)
        router.push('/dashboard')
      }
    }

    // Only run if user is available
    if (user) {
      checkAdminStatus()
    }
  }, [user?.id]) // Only depend on user.id, not the entire user object

  const fetchStats = async () => {
    try {
      setLoading(true)

      // Fetch user statistics
      const { data: userStats } = await supabase
        .from('user_profiles')
        .select('fica_status')
        .not('fica_status', 'is', null)

      // Fetch listing statistics
      const { data: listingStats } = await supabase
        .from('parts')
        .select('status')

      const totalUsers = userStats?.length || 0
      const pendingFica = userStats?.filter(u => u.fica_status === 'pending').length || 0
      const verifiedFica = userStats?.filter(u => u.fica_status === 'verified').length || 0
      const rejectedFica = userStats?.filter(u => u.fica_status === 'rejected').length || 0

      const totalListings = listingStats?.length || 0
      const activeListings = listingStats?.filter(l => l.status === 'active').length || 0

      setStats({
        totalUsers,
        pendingFica,
        verifiedFica,
        rejectedFica,
        totalListings,
        activeListings,
      })
    } catch (error) {
      console.error('Error fetching admin stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !adminCheckComplete) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Manage users, FICA verification, and platform settings
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button asChild variant="secondary">
            <Link href="/dashboard">
              <Home className="mr-2 h-4 w-4" />
              User Dashboard
            </Link>
          </Button>
          <Button onClick={fetchStats} variant="outline">
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              Users with FICA submissions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending FICA</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingFica}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verified FICA</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.verifiedFica}</div>
            <p className="text-xs text-muted-foreground">
              Successfully verified
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected FICA</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rejectedFica}</div>
            <p className="text-xs text-muted-foreground">
              Rejected submissions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              FICA Review
            </CardTitle>
            <CardDescription>
              Review and verify user FICA documents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Pending Reviews</span>
                <Badge variant="secondary">{stats.pendingFica}</Badge>
              </div>
              <Link href="/admin/fica-review">
                <Button className="w-full">
                  Review FICA Documents
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Management
            </CardTitle>
            <CardDescription>
              Manage users, roles, and account status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Total Users</span>
                <Badge variant="outline">{stats.totalUsers}</Badge>
              </div>
              <Link href="/admin/users">
                <Button className="w-full">
                  Manage Users
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Listing Management
            </CardTitle>
            <CardDescription>
              Moderate listings and review flags
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Total Listings</span>
                <Badge variant="outline">{stats.totalListings}</Badge>
              </div>
              <Link href="/admin/listings">
                <Button className="w-full">
                  Manage Listings
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Management
            </CardTitle>
            <CardDescription>
              Handle transactions and escrow
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Transactions</span>
                <Badge variant="outline">View All</Badge>
              </div>
              <Link href="/admin/payments">
                <Button className="w-full">
                  Manage Payments
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Platform Config
            </CardTitle>
            <CardDescription>
              Configure platform settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Settings</span>
                <Badge variant="outline">Configure</Badge>
              </div>
              <Link href="/admin/config">
                <Button className="w-full">
                  Platform Settings
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Platform Stats
            </CardTitle>
            <CardDescription>
              Overview of platform activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Active Listings</span>
                <Badge variant="default">{stats.activeListings}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Verified Sellers</span>
                <Badge variant="default">{stats.verifiedFica}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
