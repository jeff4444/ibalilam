"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Package,
  RefreshCw,
  X,
  MapPin,
  Warehouse,
  BarChart3,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useShop, shopQueryKeys } from "@/hooks/use-shop"
import { useAuth } from "@/hooks/use-auth"
import { createClient } from "@/utils/supabase/client"
import { Heart } from "lucide-react"
import { PartImageUpload } from "@/components/part-image-upload"
import { usePartInteractions } from "@/hooks/use-part-interactions"
import { useQueryClient } from "@tanstack/react-query"

export default function InventoryPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [locationFilter, setLocationFilter] = useState("all")
  const [priceRange, setPriceRange] = useState({ min: "", max: "" })
  const [selectedPart, setSelectedPart] = useState<any>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [partToDelete, setPartToDelete] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [distributionLocations, setDistributionLocations] = useState<string[]>([])
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    category: "",
    price: "",
    stock_quantity: "",
    status: "active",
    location_city: "",
  })
  const [editImages, setEditImages] = useState<string[]>([])
  const [partInteractions, setPartInteractions] = useState<Record<string, any>>({})
  const { user } = useAuth()
  const { 
    originalParts, 
    refurbishedParts, 
    loading, 
    refreshing,
    error, 
    refreshData 
  } = useShop()
  const { getMultiplePartInteractions } = usePartInteractions()
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Real-time subscription to parts table for automatic stock updates
  useEffect(() => {
    if (!user?.id) return

    let channel: ReturnType<typeof supabase.channel> | null = null

    const setupSubscription = async () => {
      // Get the user's shop_id
      const { data: shop } = await supabase
        .from('shops')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!shop?.id) return

      channel = supabase
        .channel('inventory-updates')
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'parts',
            filter: `shop_id=eq.${shop.id}`
          },
          () => {
            // Invalidate shop cache to refresh inventory data
            queryClient.invalidateQueries({ queryKey: shopQueryKeys.data(user.id) })
          }
        )
        .subscribe()
    }

    setupSubscription()
    
    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [user?.id, supabase, queryClient])

  // Fetch distribution locations
  useEffect(() => {
    const fetchDistributionLocations = async () => {
      if (!user?.id) return

      try {
        const { data, error } = await supabase
          .from('shops')
          .select('distribution_locations')
          .eq('user_id', user.id)
          .maybeSingle()

        if (error) {
          console.error('Error fetching distribution locations:', error)
          return
        }

        setDistributionLocations(data?.distribution_locations || [])
      } catch (err) {
        console.error('Error fetching distribution locations:', err)
      }
    }

    fetchDistributionLocations()
  }, [user?.id, supabase])

  // Fetch part interactions
  useEffect(() => {
    const fetchInteractionsData = async () => {
      if (!user?.id) return

      try {
        const allParts = [...originalParts, ...refurbishedParts]
        const partIds = allParts.map(part => part.id)

        if (partIds.length > 0) {
          const interactions = await getMultiplePartInteractions(partIds)
          setPartInteractions(interactions)
        }
      } catch (error) {
        console.error('Error fetching interactions data:', error)
      }
    }

    fetchInteractionsData()
  }, [user?.id, originalParts, refurbishedParts, getMultiplePartInteractions])

  // Combine all parts
  const allParts = useMemo(() => {
    return [...originalParts, ...refurbishedParts]
  }, [originalParts, refurbishedParts])

  // Filter parts based on all criteria including location
  const filteredParts = useMemo(() => {
    return allParts.filter(part => {
      const matchesSearch = searchTerm === "" || 
        part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        part.description?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesCategory = categoryFilter === "" || categoryFilter === "all" || part.category === categoryFilter
      
      const matchesStatus = statusFilter === "" || statusFilter === "all" || part.status === statusFilter
      
      const matchesLocation = locationFilter === "" || locationFilter === "all" || 
        (part as any).location_city === locationFilter
      
      const matchesPrice = (priceRange.min === "" || part.price >= parseFloat(priceRange.min)) &&
                         (priceRange.max === "" || part.price <= parseFloat(priceRange.max))
      
      return matchesSearch && matchesCategory && matchesStatus && matchesLocation && matchesPrice
    })
  }, [allParts, searchTerm, categoryFilter, statusFilter, locationFilter, priceRange])

  // Get unique categories for filter dropdown
  const categories = useMemo(() => {
    return [...new Set(allParts.map(part => part.category))].sort()
  }, [allParts])

  // Calculate inventory stats by location
  const locationStats = useMemo(() => {
    const stats: Record<string, { count: number; value: number }> = {}
    
    allParts.forEach(part => {
      const location = (part as any).location_city || 'Unassigned'
      if (!stats[location]) {
        stats[location] = { count: 0, value: 0 }
      }
      stats[location].count += part.stock_quantity
      stats[location].value += part.price * part.stock_quantity
    })
    
    return stats
  }, [allParts])

  // CRUD Functions
  const handleViewPart = (part: any) => {
    setSelectedPart(part)
    setIsViewModalOpen(true)
  }

  const handleEditPart = (part: any) => {
    setSelectedPart(part)
    setEditForm({
      name: part.name,
      description: part.description || "",
      category: part.category,
      price: part.price.toString(),
      stock_quantity: part.stock_quantity.toString(),
      status: part.status,
      location_city: part.location_city || "",
    })
    setEditImages(part.images || (part.image_url ? [part.image_url] : []))
    setIsEditModalOpen(true)
  }

  const handleDeletePart = (part: any) => {
    setPartToDelete(part)
    setIsDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!partToDelete) return
    
    setIsLoading(true)
    try {
      const { error } = await supabase
        .from('parts')
        .delete()
        .eq('id', partToDelete.id)

      if (error) throw error

      refreshData()
      setIsDeleteDialogOpen(false)
      setPartToDelete(null)
    } catch (error) {
      console.error('Error deleting part:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!selectedPart) return

    setIsLoading(true)
    try {
      const { error } = await supabase
        .from('parts')
        .update({
          name: editForm.name,
          description: editForm.description,
          category: editForm.category,
          price: parseFloat(editForm.price),
          stock_quantity: parseInt(editForm.stock_quantity),
          status: editForm.status,
          location_city: editForm.location_city || null,
          image_url: editImages[0] || null,
          images: editImages.length > 0 ? editImages : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedPart.id)

      if (error) throw error

      refreshData()
      setIsEditModalOpen(false)
      setSelectedPart(null)
    } catch (error) {
      console.error('Error updating part:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const clearFilters = () => {
    setSearchTerm("")
    setCategoryFilter("all")
    setStatusFilter("all")
    setLocationFilter("all")
    setPriceRange({ min: "", max: "" })
  }

  // Show loading state
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading inventory...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-background via-background to-secondary/20">
      <main className="container mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {/* Header */}
        <div className="mb-2 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Warehouse className="h-8 w-8 text-primary" />
              Inventory Management
            </h2>
            <p className="text-muted-foreground mt-1">
              Track and manage your parts across all distribution centers
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={refreshData}
              variant="outline"
              size="default"
              disabled={refreshing}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button asChild className="bg-primary hover:bg-primary/90">
              <Link href="/sell">
                <Plus className="mr-2 h-4 w-4" />
                Add New Part
              </Link>
            </Button>
          </div>
        </div>

        {/* Inventory Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total SKUs
              </CardTitle>
              <CardAction>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <Package className="h-5 w-5 text-blue-500" />
                </div>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{allParts.length}</div>
              <p className="text-xs text-muted-foreground">
                {allParts.filter(p => p.status === 'active').length} active listings
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Units
              </CardTitle>
              <CardAction>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                  <Warehouse className="h-5 w-5 text-emerald-500" />
                </div>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {allParts.reduce((sum, p) => sum + p.stock_quantity, 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Across all locations
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Inventory Value
              </CardTitle>
              <CardAction>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                  <BarChart3 className="h-5 w-5 text-amber-500" />
                </div>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                R{allParts.reduce((sum, p) => sum + (p.price * p.stock_quantity), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                Total stock value
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Distribution Centers
              </CardTitle>
              <CardAction>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                  <MapPin className="h-5 w-5 text-purple-500" />
                </div>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{distributionLocations.length}</div>
              <p className="text-xs text-muted-foreground">
                Active locations
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Location Breakdown */}
        {Object.keys(locationStats).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Inventory by Location
              </CardTitle>
              <CardDescription>
                Stock distribution across your distribution centers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {Object.entries(locationStats).map(([location, stats]) => (
                  <div 
                    key={location} 
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      locationFilter === location 
                        ? 'border-primary bg-primary/5' 
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => setLocationFilter(locationFilter === location ? 'all' : location)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{location}</span>
                      </div>
                      {locationFilter === location && (
                        <Badge variant="secondary" className="text-xs">Filtered</Badge>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Units:</span>
                        <span className="ml-1 font-medium">{stats.count.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Value:</span>
                        <span className="ml-1 font-medium">R{stats.value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Inventory Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Parts Inventory</CardTitle>
            <CardDescription className="mt-1">
              Manage your electronic parts inventory and listings
            </CardDescription>
            <div className="space-y-4 pt-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search parts..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  {/* Distribution Location Filter */}
                  <Select value={locationFilter} onValueChange={setLocationFilter}>
                    <SelectTrigger className="w-[200px]">
                      <MapPin className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="Location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All locations</SelectItem>
                      {distributionLocations.map(location => (
                        <SelectItem key={location} value={location}>{location}</SelectItem>
                      ))}
                      <SelectItem value="Unassigned">Unassigned</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {categories.map(category => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                      <SelectItem value="sold">Sold</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    placeholder="Min Price"
                    value={priceRange.min}
                    onChange={(e) => setPriceRange(prev => ({ ...prev, min: e.target.value }))}
                    className="w-[120px]"
                  />
                  <Input
                    type="number"
                    placeholder="Max Price"
                    value={priceRange.max}
                    onChange={(e) => setPriceRange(prev => ({ ...prev, max: e.target.value }))}
                    className="w-[120px]"
                  />
                  <Button variant="ghost" size="icon" onClick={clearFilters}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Product</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Saves</TableHead>
                    <TableHead>MOQ</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredParts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11}>
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                            <Package className="h-8 w-8 text-primary" />
                          </div>
                          <h3 className="mb-2 text-lg font-semibold">
                            {allParts.length === 0
                              ? "No parts found"
                              : "No parts match your current filters"}
                          </h3>
                          <p className="mb-4 text-sm text-muted-foreground">
                            {allParts.length === 0
                              ? "Get started by adding your first part to the marketplace"
                              : "Try adjusting your search criteria to see more results"}
                          </p>
                          <Button asChild className="bg-primary hover:bg-primary/90">
                            <Link href="/sell">
                              <Plus className="mr-2 h-4 w-4" />
                              {allParts.length === 0
                                ? "Add your first part"
                                : "Add a new part"}
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredParts.map((part) => (
                      <TableRow key={part.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center space-x-3">
                            <Image
                              src={part.images?.[0] || part.image_url || "/placeholder.svg"}
                              alt={part.name}
                              width={40}
                              height={40}
                              className="rounded-md"
                            />
                            <span>{part.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span>{(part as any).location_city || 'Unassigned'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={part.part_type === "refurbished" ? "secondary" : "outline"}>
                            {part.part_type === "refurbished" ? "Refurbished" : "Original"}
                          </Badge>
                        </TableCell>
                        <TableCell>{part.category}</TableCell>
                        <TableCell>R{part.price.toFixed(2)}</TableCell>
                        <TableCell>{part.stock_quantity}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              part.status === "active"
                                ? "default"
                                : part.status === "out_of_stock"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {part.status === "active"
                              ? "Active"
                              : part.status === "out_of_stock"
                              ? "Out of Stock"
                              : part.status === "draft"
                              ? "Draft"
                              : part.status === "inactive"
                              ? "Inactive"
                              : "Sold"}
                          </Badge>
                        </TableCell>
                        <TableCell>{part.views}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <Heart className="h-4 w-4 text-red-500" />
                            <span>{partInteractions[part.id]?.saves || 0}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {part.moq_units || part.moq || 1}
                          {part.pack_size_units && (
                            <div className="text-xs text-muted-foreground">
                              Pack: {part.pack_size_units}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewPart(part)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditPart(part)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => handleDeletePart(part)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            
            {/* Results count */}
            {filteredParts.length > 0 && (
              <div className="text-sm text-muted-foreground">
                Showing {filteredParts.length} of {allParts.length} parts
                {locationFilter !== 'all' && ` in ${locationFilter}`}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* View Part Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Part Details</DialogTitle>
            <DialogDescription>View detailed information about this part</DialogDescription>
          </DialogHeader>
          {selectedPart && (
            <div className="space-y-4">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <Image
                    src={selectedPart.images?.[0] || selectedPart.image_url || "/placeholder.svg"}
                    alt={selectedPart.name}
                    width={120}
                    height={120}
                    className="rounded-md"
                  />
                  {selectedPart.images && selectedPart.images.length > 1 && (
                    <div className="mt-2 flex space-x-1">
                      {selectedPart.images.slice(1, 4).map((image: string, index: number) => (
                        <Image
                          key={index}
                          src={image}
                          alt={`${selectedPart.name} ${index + 2}`}
                          width={30}
                          height={30}
                          className="rounded border"
                        />
                      ))}
                      {selectedPart.images.length > 4 && (
                        <div className="w-8 h-8 rounded border bg-gray-100 flex items-center justify-center text-xs text-gray-500">
                          +{selectedPart.images.length - 4}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="text-xl font-semibold">{selectedPart.name}</h3>
                  <p className="text-muted-foreground">{selectedPart.description || "No description"}</p>
                  <div className="flex items-center space-x-4">
                    <Badge variant="outline">{selectedPart.category}</Badge>
                    <Badge variant={
                      selectedPart.status === "active" ? "default" : 
                      selectedPart.status === "out_of_stock" ? "destructive" : 
                      "secondary"
                    }>
                      {selectedPart.status === "active" ? "Active" : 
                       selectedPart.status === "out_of_stock" ? "Out of Stock" :
                       selectedPart.status === "draft" ? "Draft" :
                       selectedPart.status === "inactive" ? "Inactive" : "Sold"}
                    </Badge>
                  </div>
                  {selectedPart.location_city && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>{selectedPart.location_city}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Price</Label>
                  <p className="text-lg font-semibold">R{selectedPart.price.toFixed(2)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Stock Quantity</Label>
                  <p className="text-lg">{selectedPart.stock_quantity}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Views</Label>
                  <p className="text-lg">{selectedPart.views}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Part Type</Label>
                  <p className="text-lg capitalize">{selectedPart.part_type}</p>
                </div>
              </div>

              {selectedPart.part_type === 'refurbished' && (
                <div className="space-y-2">
                  <h4 className="font-medium">Refurbishment Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Original Condition</Label>
                      <p className="text-sm">{selectedPart.original_condition || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Refurbished Condition</Label>
                      <p className="text-sm">{selectedPart.refurbished_condition || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Cost</Label>
                      <p className="text-sm">R{selectedPart.cost?.toFixed(2) || "0.00"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Profit</Label>
                      <p className="text-sm text-green-600">+R{selectedPart.profit?.toFixed(2) || "0.00"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Time Spent</Label>
                      <p className="text-sm">{selectedPart.time_spent_hours ? `${selectedPart.time_spent_hours}h` : "N/A"}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Part Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Part</DialogTitle>
            <DialogDescription>Update the details of this part</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                disabled={isLoading}
              />
            </div>
            
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editForm.description}
                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                disabled={isLoading}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-category">Category</Label>
                <Input
                  id="edit-category"
                  value={editForm.category}
                  onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                  disabled={isLoading}
                />
              </div>
              
              <div>
                <Label htmlFor="edit-status">Status</Label>
                <Select value={editForm.status} onValueChange={(value) => setEditForm(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger disabled={isLoading}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                    <SelectItem value="sold">Sold</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-price">Price</Label>
                <Input
                  id="edit-price"
                  type="number"
                  step="0.01"
                  value={editForm.price}
                  onChange={(e) => setEditForm(prev => ({ ...prev, price: e.target.value }))}
                  disabled={isLoading}
                />
              </div>
              
              <div>
                <Label htmlFor="edit-stock">Stock Quantity</Label>
                <Input
                  id="edit-stock"
                  type="number"
                  value={editForm.stock_quantity}
                  onChange={(e) => setEditForm(prev => ({ ...prev, stock_quantity: e.target.value }))}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Distribution Location */}
            <div>
              <Label htmlFor="edit-location" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Distribution Location
              </Label>
              <Select 
                value={editForm.location_city} 
                onValueChange={(value) => setEditForm(prev => ({ ...prev, location_city: value }))}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {distributionLocations.map(location => (
                    <SelectItem key={location} value={location}>{location}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Images Section */}
            <div className="space-y-2">
              <Label>Images</Label>
              <PartImageUpload
                images={editImages}
                onImagesChange={setEditImages}
                maxImages={8}
                disabled={isLoading}
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)} disabled={isLoading}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Part</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{partToDelete?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isLoading}>
              {isLoading ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

