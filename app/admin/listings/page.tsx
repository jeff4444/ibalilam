'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Package, 
  Search, 
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Flag,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Image as ImageIcon
} from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

interface Listing {
  id: string
  shop_id: string
  name: string
  description?: string
  category: string
  price: number
  stock_quantity: number
  status: 'active' | 'inactive' | 'draft' | 'out_of_stock' | 'sold'
  part_type: 'original' | 'refurbished'
  views: number
  image_url?: string
  images?: string[]
  is_flagged: boolean
  flag_reason?: string
  flag_count: number
  created_at: string
  updated_at: string
  shop_name: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const categories = [
  { value: 'all', label: 'All Categories' },
  { value: 'mobile_phones', label: 'Mobile Phones' },
  { value: 'phone_parts', label: 'Phone Parts' },
  { value: 'phone_accessories', label: 'Phone Accessories' },
  { value: 'laptops', label: 'Laptops' },
  { value: 'steam_kits', label: 'STEAM Kits' },
  { value: 'other_electronics', label: 'Other Electronics' }
]

export default function AdminListingsPage() {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showActionModal, setShowActionModal] = useState(false)
  const [actionType, setActionType] = useState<'suspend' | 'clear_flag'>('suspend')
  const [actionReason, setActionReason] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    fetchListings()
  }, [searchTerm, statusFilter, categoryFilter, flaggedOnly, pagination.page])

  const fetchListings = async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      })
      
      if (searchTerm) params.set('search', searchTerm)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (categoryFilter !== 'all') params.set('category', categoryFilter)
      if (flaggedOnly) params.set('flagged', 'true')

      const response = await fetch(`/api/admin/listings?${params}`)
      const data = await response.json()
      
      if (response.ok) {
        setListings(data.listings)
        setPagination(prev => ({ ...prev, ...data.pagination }))
      }
    } catch (error) {
      console.error('Error fetching listings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async () => {
    if (!selectedListing) return

    try {
      setIsProcessing(true)

      const response = await fetch('/api/admin/listings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: selectedListing.id,
          action: actionType,
          reason: actionReason
        })
      })

      if (response.ok) {
        setShowActionModal(false)
        setSelectedListing(null)
        setActionReason('')
        fetchListings()
      }
    } catch (error) {
      console.error('Error processing action:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleApprove = async (listing: Listing) => {
    try {
      setIsProcessing(true)

      const response = await fetch('/api/admin/listings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: listing.id,
          action: 'approve'
        })
      })

      if (response.ok) {
        fetchListings()
      }
    } catch (error) {
      console.error('Error approving listing:', error)
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Active</Badge>
      case 'draft':
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">Draft</Badge>
      case 'inactive':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Inactive</Badge>
      case 'out_of_stock':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Out of Stock</Badge>
      case 'sold':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Sold</Badge>
      default:
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">{status}</Badge>
    }
  }

  const activeListings = listings.filter(l => l.status === 'active').length
  const draftListings = listings.filter(l => l.status === 'draft').length
  const flaggedListings = listings.filter(l => l.is_flagged).length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Listings</h1>
          <p className="text-slate-400 mt-1">Manage platform listings and moderate content</p>
        </div>
        <Button onClick={fetchListings} variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Package className="h-8 w-8 text-slate-400" />
              <div>
                <p className="text-2xl font-bold text-white">{pagination.total}</p>
                <p className="text-sm text-slate-400">Total Listings</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <CheckCircle className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold text-white">{activeListings}</p>
                <p className="text-sm text-slate-400">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold text-white">{draftListings}</p>
                <p className="text-sm text-slate-400">Draft</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`bg-slate-900 border-slate-800 cursor-pointer transition-all hover:border-red-500/50 ${flaggedOnly ? 'border-red-500' : ''}`}
          onClick={() => setFlaggedOnly(!flaggedOnly)}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Flag className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold text-white">{flaggedListings}</p>
                <p className="text-sm text-slate-400">Flagged</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search listings..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="out_of_stock">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {categories.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={flaggedOnly ? 'default' : 'outline'}
              onClick={() => setFlaggedOnly(!flaggedOnly)}
              className={flaggedOnly ? 'bg-red-600 hover:bg-red-700' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}
            >
              <Flag className="mr-2 h-4 w-4" />
              Flagged Only
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Listings Table */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Listings ({pagination.total})</CardTitle>
          <CardDescription className="text-slate-400">Manage and moderate listings</CardDescription>
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
                    <TableHead className="text-slate-400">Listing</TableHead>
                    <TableHead className="text-slate-400">Shop</TableHead>
                    <TableHead className="text-slate-400">Category</TableHead>
                    <TableHead className="text-slate-400">Price</TableHead>
                    <TableHead className="text-slate-400">Stock</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listings.map((listing) => (
                    <TableRow key={listing.id} className="border-slate-800 hover:bg-slate-800/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-slate-800 flex items-center justify-center overflow-hidden">
                            {listing.image_url ? (
                              <img src={listing.image_url} alt={listing.name} className="h-full w-full object-cover" />
                            ) : (
                              <ImageIcon className="h-5 w-5 text-slate-500" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-white flex items-center gap-2">
                              {listing.name}
                              {listing.is_flagged && (
                                <Flag className="h-4 w-4 text-red-500" />
                              )}
                            </div>
                            <div className="text-sm text-slate-500">{listing.views} views</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-300">{listing.shop_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-slate-600 text-slate-300">
                          {listing.category.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-white">{formatCurrency(listing.price)}</TableCell>
                      <TableCell className="text-slate-300">{listing.stock_quantity}</TableCell>
                      <TableCell>{getStatusBadge(listing.status)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-white">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                            <DropdownMenuItem 
                              onClick={() => { setSelectedListing(listing); setShowDetailsModal(true) }}
                              className="text-slate-300 focus:bg-slate-700 focus:text-white"
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            {listing.status === 'draft' && (
                              <DropdownMenuItem 
                                onClick={() => handleApprove(listing)}
                                className="text-emerald-400 focus:bg-slate-700 focus:text-emerald-300"
                                disabled={isProcessing}
                              >
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Approve Listing
                              </DropdownMenuItem>
                            )}
                            {listing.status === 'active' && (
                              <DropdownMenuItem 
                                onClick={() => { setSelectedListing(listing); setActionType('suspend'); setShowActionModal(true) }}
                                className="text-red-400 focus:bg-slate-700 focus:text-red-300"
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                Suspend Listing
                              </DropdownMenuItem>
                            )}
                            {listing.is_flagged && (
                              <DropdownMenuItem 
                                onClick={() => { setSelectedListing(listing); setActionType('clear_flag'); setShowActionModal(true) }}
                                className="text-yellow-400 focus:bg-slate-700 focus:text-yellow-300"
                              >
                                <Flag className="mr-2 h-4 w-4" />
                                Clear Flag
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
            <DialogTitle>Listing Details</DialogTitle>
            <DialogDescription className="text-slate-400">View listing information</DialogDescription>
          </DialogHeader>
          {selectedListing && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="h-32 w-32 rounded-lg bg-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {selectedListing.image_url ? (
                    <img src={selectedListing.image_url} alt={selectedListing.name} className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-slate-500" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                    {selectedListing.name}
                    {selectedListing.is_flagged && <Flag className="h-5 w-5 text-red-500" />}
                  </h3>
                  <p className="text-slate-400 mt-1">{selectedListing.description || 'No description'}</p>
                  <div className="flex gap-2 mt-2">
                    {getStatusBadge(selectedListing.status)}
                    <Badge variant="outline" className="border-slate-600 text-slate-300">
                      {selectedListing.part_type}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-400">Price</Label>
                  <p className="text-white text-xl font-semibold">{formatCurrency(selectedListing.price)}</p>
                </div>
                <div>
                  <Label className="text-slate-400">Stock</Label>
                  <p className="text-white text-xl font-semibold">{selectedListing.stock_quantity}</p>
                </div>
                <div>
                  <Label className="text-slate-400">Shop</Label>
                  <p className="text-white">{selectedListing.shop_name}</p>
                </div>
                <div>
                  <Label className="text-slate-400">Category</Label>
                  <p className="text-white">{selectedListing.category.replace('_', ' ')}</p>
                </div>
                <div>
                  <Label className="text-slate-400">Views</Label>
                  <p className="text-white">{selectedListing.views}</p>
                </div>
                <div>
                  <Label className="text-slate-400">Created</Label>
                  <p className="text-white">{new Date(selectedListing.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              {selectedListing.is_flagged && selectedListing.flag_reason && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                  <Label className="text-red-400">Flag Reason</Label>
                  <p className="text-white mt-1">{selectedListing.flag_reason}</p>
                  <p className="text-sm text-red-400 mt-1">Flagged {selectedListing.flag_count} times</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Modal */}
      <Dialog open={showActionModal} onOpenChange={setShowActionModal}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'suspend' ? 'Suspend Listing' : 'Clear Flag'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {actionType === 'suspend' 
                ? 'This will suspend the listing and hide it from the marketplace.'
                : 'This will clear the flag and dismiss the reports.'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedListing && (
              <div>
                <Label className="text-slate-400">Listing</Label>
                <p className="text-white">{selectedListing.name}</p>
              </div>
            )}
            
            {actionType === 'suspend' && (
              <div>
                <Label htmlFor="action-reason" className="text-slate-400">Reason</Label>
                <Textarea
                  id="action-reason"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Provide a reason for suspension..."
                  className="bg-slate-800 border-slate-700 text-white mt-1"
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowActionModal(false)} className="border-slate-700 text-slate-300">
                Cancel
              </Button>
              <Button
                onClick={handleAction}
                disabled={isProcessing || (actionType === 'suspend' && !actionReason)}
                variant={actionType === 'suspend' ? 'destructive' : 'default'}
                className={actionType !== 'suspend' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              >
                {isProcessing ? 'Processing...' : actionType === 'suspend' ? 'Suspend' : 'Clear Flag'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
