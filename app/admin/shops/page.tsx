'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Store, 
  Search, 
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  DollarSign,
  Package,
  Star,
  TrendingUp,
  Lock,
  Wallet,
  Power,
  PowerOff
} from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

interface Shop {
  id: string
  user_id: string
  name: string
  description?: string
  rating: number
  review_count: number
  total_sales: number
  total_views: number
  active_listings: number
  is_active: boolean
  locked_balance: number
  available_balance: number
  created_at: string
  updated_at: string
  owner_name: string
  owner_fica_status?: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function AdminShopsPage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    fetchShops()
  }, [searchTerm, statusFilter, pagination.page])

  const fetchShops = async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      })
      
      if (searchTerm) params.set('search', searchTerm)
      if (statusFilter !== 'all') params.set('status', statusFilter)

      const response = await fetch(`/api/admin/shops?${params}`)
      const data = await response.json()
      
      if (response.ok) {
        setShops(data.shops)
        setPagination(prev => ({ ...prev, ...data.pagination }))
      }
    } catch (error) {
      console.error('Error fetching shops:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async (shop: Shop) => {
    try {
      setIsProcessing(true)

      const response = await fetch('/api/admin/shops', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: shop.id,
          action: shop.is_active ? 'deactivate' : 'activate'
        })
      })

      if (response.ok) {
        fetchShops()
      }
    } catch (error) {
      console.error('Error toggling shop status:', error)
    } finally {
      setIsProcessing(false)
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

  const totalBalance = shops.reduce((sum, s) => sum + s.available_balance + s.locked_balance, 0)
  const totalLockedBalance = shops.reduce((sum, s) => sum + s.locked_balance, 0)
  const activeShops = shops.filter(s => s.is_active).length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Shops</h1>
          <p className="text-slate-400 mt-1">Manage platform shops and seller accounts</p>
        </div>
        <Button onClick={fetchShops} variant="outline" className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700 hover:border-slate-500 hover:text-white">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Store className="h-8 w-8 text-slate-400" />
              <div>
                <p className="text-2xl font-bold text-white">{pagination.total}</p>
                <p className="text-sm text-slate-400">Total Shops</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Power className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold text-white">{activeShops}</p>
                <p className="text-sm text-slate-400">Active Shops</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Wallet className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold text-white">{formatCurrency(totalBalance)}</p>
                <p className="text-sm text-slate-400">Total Balance</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Lock className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold text-white">{formatCurrency(totalLockedBalance)}</p>
                <p className="text-sm text-slate-400">Locked (Escrow)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search shops..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48 bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Shops Table */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Shops ({pagination.total})</CardTitle>
          <CardDescription className="text-slate-400">Manage shop accounts and balances</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400">Shop</TableHead>
                    <TableHead className="text-slate-400">Owner</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400">Listings</TableHead>
                    <TableHead className="text-slate-400">Rating</TableHead>
                    <TableHead className="text-slate-400">Balance</TableHead>
                    <TableHead className="text-slate-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shops.map((shop) => (
                    <TableRow key={shop.id} className="border-slate-800 hover:bg-slate-800/50">
                      <TableCell>
                        <div>
                          <div className="font-medium text-white">{shop.name}</div>
                          <div className="text-sm text-slate-500">
                            {shop.total_views} views • {formatCurrency(shop.total_sales)} sales
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="text-white">{shop.owner_name}</div>
                          {shop.owner_fica_status && (
                            <Badge 
                              className={`text-xs ${
                                shop.owner_fica_status === 'verified' 
                                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                                  : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                              }`}
                            >
                              FICA: {shop.owner_fica_status}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {shop.is_active ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Active</Badge>
                        ) : (
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-slate-300">
                          <Package className="h-4 w-4 text-slate-500" />
                          {shop.active_listings}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-slate-300">
                          <Star className="h-4 w-4 text-yellow-500" />
                          {shop.rating.toFixed(1)} ({shop.review_count})
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="text-white">{formatCurrency(shop.available_balance)}</div>
                          {shop.locked_balance > 0 && (
                            <div className="text-xs text-yellow-400 flex items-center gap-1">
                              <Lock className="h-3 w-3" />
                              {formatCurrency(shop.locked_balance)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-white">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                            <DropdownMenuItem 
                              onClick={() => { setSelectedShop(shop); setShowDetailsModal(true) }}
                              className="text-slate-300 focus:bg-slate-700 focus:text-white"
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            {shop.is_active ? (
                              <DropdownMenuItem 
                                onClick={() => handleToggleStatus(shop)}
                                className="text-red-400 focus:bg-slate-700 focus:text-red-300"
                                disabled={isProcessing}
                              >
                                <PowerOff className="mr-2 h-4 w-4" />
                                Deactivate Shop
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem 
                                onClick={() => handleToggleStatus(shop)}
                                className="text-emerald-400 focus:bg-slate-700 focus:text-emerald-300"
                                disabled={isProcessing}
                              >
                                <Power className="mr-2 h-4 w-4" />
                                Activate Shop
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-slate-400">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-slate-400">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page === pagination.totalPages}
                    className="border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>Shop Details</DialogTitle>
            <DialogDescription className="text-slate-400">View shop information and statistics</DialogDescription>
          </DialogHeader>
          {selectedShop && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-400">Shop Name</Label>
                  <p className="text-white">{selectedShop.name}</p>
                </div>
                <div>
                  <Label className="text-slate-400">Owner</Label>
                  <p className="text-white">{selectedShop.owner_name}</p>
                </div>
                <div>
                  <Label className="text-slate-400">Status</Label>
                  <p className="text-white">{selectedShop.is_active ? 'Active' : 'Inactive'}</p>
                </div>
                <div>
                  <Label className="text-slate-400">Created</Label>
                  <p className="text-white">{new Date(selectedShop.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              {selectedShop.description && (
                <div>
                  <Label className="text-slate-400">Description</Label>
                  <p className="text-white">{selectedShop.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-slate-800 border-slate-700">
                  <CardContent className="pt-4 pb-4">
                    <Package className="h-5 w-5 text-blue-400 mb-2" />
                    <p className="text-2xl font-bold text-white">{selectedShop.active_listings}</p>
                    <p className="text-xs text-slate-400">Active Listings</p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-800 border-slate-700">
                  <CardContent className="pt-4 pb-4">
                    <Star className="h-5 w-5 text-yellow-400 mb-2" />
                    <p className="text-2xl font-bold text-white">{selectedShop.rating.toFixed(1)}</p>
                    <p className="text-xs text-slate-400">{selectedShop.review_count} Reviews</p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-800 border-slate-700">
                  <CardContent className="pt-4 pb-4">
                    <TrendingUp className="h-5 w-5 text-emerald-400 mb-2" />
                    <p className="text-2xl font-bold text-white">{selectedShop.total_views}</p>
                    <p className="text-xs text-slate-400">Total Views</p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-800 border-slate-700">
                  <CardContent className="pt-4 pb-4">
                    <DollarSign className="h-5 w-5 text-green-400 mb-2" />
                    <p className="text-2xl font-bold text-white">{formatCurrency(selectedShop.total_sales)}</p>
                    <p className="text-xs text-slate-400">Total Sales</p>
                  </CardContent>
                </Card>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <Label className="text-slate-400 mb-3 block">Balance Information</Label>
                <div className="grid grid-cols-2 gap-4">
                  <Card className="bg-emerald-500/10 border-emerald-500/30">
                    <CardContent className="pt-4 pb-4">
                      <Wallet className="h-5 w-5 text-emerald-400 mb-2" />
                      <p className="text-2xl font-bold text-white">{formatCurrency(selectedShop.available_balance)}</p>
                      <p className="text-xs text-emerald-400">Available Balance</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-yellow-500/10 border-yellow-500/30">
                    <CardContent className="pt-4 pb-4">
                      <Lock className="h-5 w-5 text-yellow-400 mb-2" />
                      <p className="text-2xl font-bold text-white">{formatCurrency(selectedShop.locked_balance)}</p>
                      <p className="text-xs text-yellow-400">Locked (Escrow)</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

