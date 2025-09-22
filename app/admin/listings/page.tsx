'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { 
  Package, 
  Search, 
  Eye, 
  EyeOff, 
  Trash2, 
  Flag, 
  CheckCircle,
  XCircle,
  AlertTriangle,
  Home,
  Filter,
  MoreHorizontal,
  User,
  Calendar,
  DollarSign
} from 'lucide-react'
import Link from 'next/link'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import Image from 'next/image'

interface Listing {
  id: string
  name: string
  description: string
  category: string
  subcategory: string | null
  brand: string | null
  model: string | null
  price: number
  stock_quantity: number
  status: 'active' | 'inactive' | 'out_of_stock' | 'sold' | 'draft'
  part_type: 'original' | 'refurbished'
  image_url: string | null
  images: string[] | null
  views: number
  created_at: string
  updated_at: string
  published_at: string | null
  shop_id: string
  shop_name: string
  seller_name: string
  seller_email: string
  is_flagged: boolean
  flag_reason: string | null
  flag_count: number
  admin_notes: string | null
}

interface FlagReport {
  id: string
  part_id: string
  reporter_id: string
  reason: string
  description: string
  status: 'pending' | 'resolved' | 'dismissed'
  created_at: string
  reporter_name: string
  part_name: string
}

export default function AdminListingsPage() {
  const [listings, setListings] = useState<Listing[]>([])
  const [flagReports, setFlagReports] = useState<FlagReport[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [flagFilter, setFlagFilter] = useState('all')
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null)
  const [showListingModal, setShowListingModal] = useState(false)
  const [showFlagModal, setShowFlagModal] = useState(false)
  const [adminNotes, setAdminNotes] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
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
          .select('user_role')
          .eq('user_id', user.id)
          .single()

        if (error || !profile || profile.user_role !== 'admin') {
          router.push('/dashboard')
          return
        }

        fetchListings()
        fetchFlagReports()
      } catch (error) {
        console.error('Error checking admin status:', error)
        router.push('/dashboard')
      }
    }

    if (user) {
      checkAdminStatus()
    }
  }, [user?.id])

  const fetchListings = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('parts')
        .select(`
          *,
          shops!inner(
            name,
            user_id
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      const transformedListings = data?.map(part => ({
        id: part.id,
        name: part.name,
        description: part.description || '',
        category: part.category,
        subcategory: part.subcategory,
        brand: part.brand,
        model: part.model,
        price: part.price,
        stock_quantity: part.stock_quantity,
        status: part.status,
        part_type: part.part_type,
        image_url: part.image_url,
        images: part.images,
        views: part.views || 0,
        created_at: part.created_at,
        updated_at: part.updated_at,
        published_at: part.published_at,
        shop_id: part.shop_id,
        shop_name: part.shops?.name || 'Unknown Shop',
        seller_name: 'Unknown Seller', // We can't access user profile data directly
        seller_email: 'Unknown Email', // We can't access auth.users email directly
        is_flagged: part.is_flagged || false,
        flag_reason: part.flag_reason,
        flag_count: part.flag_count || 0,
        admin_notes: part.admin_notes
      })) || []

      setListings(transformedListings)
    } catch (err: any) {
      console.error('Error fetching listings:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchFlagReports = async () => {
    try {
      const { data, error } = await supabase
        .from('part_flags')
        .select(`
          *,
          part:parts!part_flags_part_id_fkey(name)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      const transformedReports = data?.map(flag => ({
        id: flag.id,
        part_id: flag.part_id,
        reporter_id: flag.reporter_id,
        reason: flag.reason,
        description: flag.description,
        status: flag.status,
        created_at: flag.created_at,
        reporter_name: 'Anonymous', // We can't access user profile data directly
        part_name: flag.part?.name || 'Unknown Part'
      })) || []

      setFlagReports(transformedReports)
    } catch (err: any) {
      console.error('Error fetching flag reports:', err)
    }
  }

  const handleListingAction = async (action: 'hide' | 'show' | 'remove', listingId: string) => {
    try {
      setIsProcessing(true)
      setError(null)

      let updateData: any = {}
      
      switch (action) {
        case 'hide':
          updateData = { status: 'inactive', admin_notes: adminNotes }
          break
        case 'show':
          updateData = { status: 'active', admin_notes: adminNotes }
          break
        case 'remove':
          // Delete the listing
          const { error: deleteError } = await supabase
            .from('parts')
            .delete()
            .eq('id', listingId)

          if (deleteError) throw deleteError
          break
      }

      if (action !== 'remove') {
        const { error } = await supabase
          .from('parts')
          .update(updateData)
          .eq('id', listingId)

        if (error) throw error
      }

      setShowListingModal(false)
      setSelectedListing(null)
      setAdminNotes('')
      fetchListings()
    } catch (err: any) {
      console.error('Error processing listing action:', err)
      setError(err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFlagAction = async (flagId: string, action: 'resolve' | 'dismiss') => {
    try {
      setIsProcessing(true)
      setError(null)

      const { error } = await supabase
        .from('part_flags')
        .update({ 
          status: action === 'resolve' ? 'resolved' : 'dismissed',
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id
        })
        .eq('id', flagId)

      if (error) throw error

      fetchFlagReports()
    } catch (err: any) {
      console.error('Error processing flag action:', err)
      setError(err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const filteredListings = listings.filter(listing => {
    const matchesSearch = searchTerm === '' || 
      listing.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      listing.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      listing.seller_name.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesCategory = categoryFilter === 'all' || listing.category === categoryFilter
    const matchesStatus = statusFilter === 'all' || listing.status === statusFilter
    const matchesType = typeFilter === 'all' || listing.part_type === typeFilter
    const matchesFlag = flagFilter === 'all' || 
      (flagFilter === 'flagged' && listing.is_flagged) ||
      (flagFilter === 'not_flagged' && !listing.is_flagged)

    return matchesSearch && matchesCategory && matchesStatus && matchesType && matchesFlag
  })

  const categories = [...new Set(listings.map(l => l.category))].sort()

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading listings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Listing Management</h1>
          <p className="text-muted-foreground">
            Manage product listings, review flags, and moderate content
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button asChild variant="secondary">
            <Link href="/admin">
              <Home className="mr-2 h-4 w-4" />
              Admin Dashboard
            </Link>
          </Button>
          <Button onClick={() => setShowFlagModal(true)} variant="outline">
            <Flag className="mr-2 h-4 w-4" />
            Flag Reports ({flagReports.filter(f => f.status === 'pending').length})
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Listings</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{listings.length}</div>
            <p className="text-xs text-muted-foreground">
              All product listings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Listings</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {listings.filter(l => l.status === 'active').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently visible
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Flagged Listings</CardTitle>
            <Flag className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {listings.filter(l => l.is_flagged).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Require review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Flags</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {flagReports.filter(f => f.status === 'pending').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Awaiting review
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Listing Search & Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search listings..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
                <SelectItem value="out_of_stock">Out of Stock</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="original">Original</SelectItem>
                <SelectItem value="refurbished">Refurbished</SelectItem>
              </SelectContent>
            </Select>

            <Select value={flagFilter} onValueChange={setFlagFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Flag status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All listings</SelectItem>
                <SelectItem value="flagged">Flagged</SelectItem>
                <SelectItem value="not_flagged">Not flagged</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Listings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Listings ({filteredListings.length})</CardTitle>
          <CardDescription>Manage product listings and moderate content</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Views</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredListings.map((listing) => (
                <TableRow key={listing.id}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Image
                        src={listing.images?.[0] || listing.image_url || "/placeholder.svg"}
                        alt={listing.name}
                        width={40}
                        height={40}
                        className="rounded-md"
                      />
                      <div>
                        <div className="font-medium">{listing.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {listing.part_type} • {listing.brand || 'No brand'}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{listing.seller_name}</div>
                      <div className="text-sm text-muted-foreground">{listing.seller_email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{listing.category}</Badge>
                  </TableCell>
                  <TableCell>${listing.price.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={
                      listing.status === "active" ? "default" : 
                      listing.status === "out_of_stock" ? "destructive" : 
                      "secondary"
                    }>
                      {listing.status === "active" ? "Active" : 
                       listing.status === "out_of_stock" ? "Out of Stock" :
                       listing.status === "draft" ? "Draft" :
                       listing.status === "inactive" ? "Inactive" : "Sold"}
                    </Badge>
                  </TableCell>
                  <TableCell>{listing.views}</TableCell>
                  <TableCell>
                    {listing.is_flagged ? (
                      <Badge variant="destructive">{listing.flag_count}</Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(listing.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          setSelectedListing(listing)
                          setShowListingModal(true)
                        }}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        {listing.status === 'active' ? (
                          <DropdownMenuItem onClick={() => {
                            setSelectedListing(listing)
                            setShowListingModal(true)
                          }}>
                            <EyeOff className="mr-2 h-4 w-4" />
                            Hide Listing
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => {
                            setSelectedListing(listing)
                            setShowListingModal(true)
                          }}>
                            <Eye className="mr-2 h-4 w-4" />
                            Show Listing
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          className="text-red-600"
                          onClick={() => {
                            setSelectedListing(listing)
                            setShowListingModal(true)
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove Listing
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Listing Details Modal */}
      <Dialog open={showListingModal} onOpenChange={setShowListingModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Listing Details</DialogTitle>
            <DialogDescription>View and manage product listing</DialogDescription>
          </DialogHeader>
          {selectedListing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Product Name</Label>
                  <p className="text-sm">{selectedListing.name}</p>
                </div>
                <div>
                  <Label>Seller</Label>
                  <p className="text-sm">{selectedListing.seller_name} ({selectedListing.seller_email})</p>
                </div>
                <div>
                  <Label>Category</Label>
                  <p className="text-sm">{selectedListing.category}</p>
                </div>
                <div>
                  <Label>Price</Label>
                  <p className="text-sm">${selectedListing.price.toFixed(2)}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <p className="text-sm">{selectedListing.status}</p>
                </div>
                <div>
                  <Label>Views</Label>
                  <p className="text-sm">{selectedListing.views}</p>
                </div>
              </div>

              <div>
                <Label>Description</Label>
                <p className="text-sm">{selectedListing.description}</p>
              </div>

              {selectedListing.is_flagged && (
                <div>
                  <Label>Flag Information</Label>
                  <p className="text-sm text-red-600">
                    Flagged {selectedListing.flag_count} times. Reason: {selectedListing.flag_reason}
                  </p>
                </div>
              )}

              {selectedListing.admin_notes && (
                <div>
                  <Label>Admin Notes</Label>
                  <p className="text-sm">{selectedListing.admin_notes}</p>
                </div>
              )}

              <div>
                <Label htmlFor="admin-notes">Admin Notes</Label>
                <Textarea
                  id="admin-notes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes about this listing..."
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowListingModal(false)}>
                  Cancel
                </Button>
                {selectedListing.status === 'active' ? (
                  <Button 
                    onClick={() => handleListingAction('hide', selectedListing.id)}
                    variant="destructive"
                    disabled={isProcessing}
                  >
                    {isProcessing ? 'Hiding...' : 'Hide Listing'}
                  </Button>
                ) : (
                  <Button 
                    onClick={() => handleListingAction('show', selectedListing.id)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? 'Showing...' : 'Show Listing'}
                  </Button>
                )}
                <Button 
                  onClick={() => handleListingAction('remove', selectedListing.id)}
                  variant="destructive"
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Removing...' : 'Remove Listing'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Flag Reports Modal */}
      <Dialog open={showFlagModal} onOpenChange={setShowFlagModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Flag Reports</DialogTitle>
            <DialogDescription>Review and manage flagged content</DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part</TableHead>
                  <TableHead>Reporter</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flagReports.map((flag) => (
                  <TableRow key={flag.id}>
                    <TableCell className="font-medium">{flag.part_name}</TableCell>
                    <TableCell>{flag.reporter_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{flag.reason}</Badge>
                    </TableCell>
                    <TableCell>{flag.description}</TableCell>
                    <TableCell>
                      <Badge variant={
                        flag.status === 'pending' ? 'secondary' :
                        flag.status === 'resolved' ? 'default' : 'destructive'
                      }>
                        {flag.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(flag.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {flag.status === 'pending' && (
                        <div className="flex space-x-2">
                          <Button 
                            size="sm" 
                            onClick={() => handleFlagAction(flag.id, 'resolve')}
                            disabled={isProcessing}
                          >
                            Resolve
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleFlagAction(flag.id, 'dismiss')}
                            disabled={isProcessing}
                          >
                            Dismiss
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
