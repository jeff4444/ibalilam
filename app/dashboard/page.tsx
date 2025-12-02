"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  Cpu,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Package,
  Wrench,
  Store,
  TrendingUp,
  RefreshCw,
  X,
  Wallet,
  Lock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CartButton } from "@/components/cart-button"
import { MainNavbar } from "@/components/navbar"
import { useShop } from "@/hooks/use-shop"
import { useAuth } from "@/hooks/use-auth"
import { useFica } from "@/hooks/use-fica"
import { usePartInteractions } from "@/hooks/use-part-interactions"
import { createClient } from "@/utils/supabase/client"
import { Shield, MessageCircle, Heart, Upload, FileText } from "lucide-react"
import { PartImageUpload } from "@/components/part-image-upload"
import { FicaUpload } from "@/components/fica-upload"

export default function DashboardPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priceRange, setPriceRange] = useState({ min: "", max: "" })
  const [selectedPart, setSelectedPart] = useState<any>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [partToDelete, setPartToDelete] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isSeller, setIsSeller] = useState<boolean | null>(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    category: "",
    price: "",
    stock_quantity: "",
    status: "active",
  })
  const [editImages, setEditImages] = useState<string[]>([])
  const [partInteractions, setPartInteractions] = useState<Record<string, any>>({})
  const [sellerChats, setSellerChats] = useState<any[]>([])
  const [showFicaModal, setShowFicaModal] = useState(false)
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { 
    shopStats, 
    originalParts, 
    refurbishedParts, 
    recentOrders, 
    loading, 
    refreshing,
    error, 
    refreshData 
  } = useShop()
  const { ficaStatus, documents, loading: ficaLoading } = useFica()
  const { getMultiplePartInteractions, getSellerChats } = usePartInteractions()
  const supabase = createClient()

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  // Check if user is admin, seller, and FICA verified
  useEffect(() => {
    const checkUserStatus = async () => {
      if (user?.id) {
        try {
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("user_role, is_admin, fica_status")
            .eq("user_id", user.id)
            .single()

          setIsAdmin(Boolean(profile?.is_admin))
          const isSeller = profile?.user_role === "seller"
          const isFicaVerified = profile?.fica_status === "verified"
          
          setIsSeller(isSeller)
          
          // Redirect if not a seller or not FICA verified
          if (!isSeller || !isFicaVerified) {
            setAccessDenied(true)
            router.push("/profile")
          }
        } catch (error) {
          console.error('Error checking user status:', error)
          setIsAdmin(false)
          setIsSeller(null)
          setAccessDenied(true)
          router.push("/profile")
        }
      }
    }

    checkUserStatus()
  }, [user?.id, supabase, router])

  // Redirect non-seller users away from dashboard
  useEffect(() => {
    if (!authLoading && user && isSeller === false) {
      setAccessDenied(true)
      router.push("/profile")
    }
  }, [authLoading, user, isSeller, router])

  // Fetch part interactions and chats
  useEffect(() => {
    const fetchInteractionsData = async () => {
      if (!user?.id) return

      try {
        // Get all part IDs
        const allParts = [...originalParts, ...refurbishedParts]
        const partIds = allParts.map(part => part.id)

        if (partIds.length > 0) {
          // Fetch interactions for all parts
          const interactions = await getMultiplePartInteractions(partIds)
          setPartInteractions(interactions)

          // Fetch seller chats
          const chats = await getSellerChats()
          setSellerChats(chats)
        }
      } catch (error) {
        console.error('Error fetching interactions data:', error)
      }
    }

    fetchInteractionsData()
  }, [user?.id, originalParts, refurbishedParts, getMultiplePartInteractions, getSellerChats])

  // Filter parts based on search and filter criteria
  const filteredOriginalParts = useMemo(() => {
    return originalParts.filter(part => {
      const matchesSearch = searchTerm === "" || 
        part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        part.description?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesCategory = categoryFilter === "" || categoryFilter === "all" || part.category === categoryFilter
      
      const matchesStatus = statusFilter === "" || statusFilter === "all" || part.status === statusFilter
      
      const matchesPrice = (priceRange.min === "" || part.price >= parseFloat(priceRange.min)) &&
                         (priceRange.max === "" || part.price <= parseFloat(priceRange.max))
      
      return matchesSearch && matchesCategory && matchesStatus && matchesPrice
    })
  }, [originalParts, searchTerm, categoryFilter, statusFilter, priceRange])

  // Combined filtered parts (merging original and refurbished)
  const filteredAllParts = useMemo(() => {
    const allParts = [...originalParts, ...refurbishedParts]
    return allParts.filter(part => {
      const matchesSearch = searchTerm === "" || 
        part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        part.description?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesCategory = categoryFilter === "" || categoryFilter === "all" || part.category === categoryFilter
      
      const matchesStatus = statusFilter === "" || statusFilter === "all" || part.status === statusFilter
      
      const matchesPrice = (priceRange.min === "" || part.price >= parseFloat(priceRange.min)) &&
                         (priceRange.max === "" || part.price <= parseFloat(priceRange.max))
      
      return matchesSearch && matchesCategory && matchesStatus && matchesPrice
    })
  }, [originalParts, refurbishedParts, searchTerm, categoryFilter, statusFilter, priceRange])

  const filteredRefurbishedParts = useMemo(() => {
    return refurbishedParts.filter(part => {
      const matchesSearch = searchTerm === "" || 
        part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        part.description?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesCategory = categoryFilter === "" || categoryFilter === "all" || part.category === categoryFilter
      
      const matchesStatus = statusFilter === "" || statusFilter === "all" || part.status === statusFilter
      
      const matchesPrice = (priceRange.min === "" || part.price >= parseFloat(priceRange.min)) &&
                         (priceRange.max === "" || part.price <= parseFloat(priceRange.max))
      
      return matchesSearch && matchesCategory && matchesStatus && matchesPrice
    })
  }, [refurbishedParts, searchTerm, categoryFilter, statusFilter, priceRange])

  // Get unique categories for filter dropdown
  const categories = useMemo(() => {
    const allParts = [...originalParts, ...refurbishedParts]
    return [...new Set(allParts.map(part => part.category))].sort()
  }, [originalParts, refurbishedParts])

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
    })
    // Set images from the part data
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

      // Refresh data to update the UI
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
          image_url: editImages[0] || null,
          images: editImages.length > 0 ? editImages : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedPart.id)

      if (error) throw error

      // Refresh data to update the UI
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
    setPriceRange({ min: "", max: "" })
  }

  // Show loading state while checking authentication
  if (authLoading || loading || isSeller === null || accessDenied) {
    return (
      <div className="flex flex-col min-h-screen">
        <MainNavbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex flex-col">
      <MainNavbar />

      <main className="flex-1 container mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div className="mb-2 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
            <p className="text-muted-foreground mt-1">
              Manage your parts inventory and track sales performance
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Button asChild variant="secondary">
                <Link href="/admin">
                  <Shield className="mr-2 h-4 w-4" />
                  Admin Panel
                </Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href="/dashboard/transactions">
                <Package className="mr-2 h-4 w-4" />
                Transactions
              </Link>
            </Button>
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

        {/* Stats Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5 mb-2">
          <Link href="/wallet" className="block">
            <Card className="border-l-4 border-l-emerald-500 hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Available Balance
              </CardTitle>
              <CardAction>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                  <Wallet className="h-5 w-5 text-emerald-500" />
                </div>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-600">
                  R {(shopStats?.wallet_available_balance ?? shopStats?.available_balance ?? 0).toLocaleString(
                  undefined,
                  {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }
                  )}
              </div>
              <p className="text-xs text-muted-foreground">
                  Ready for withdrawal • Click to manage wallet
              </p>
            </CardContent>
          </Card>
          </Link>
          <Link href="/wallet" className="block">
            <Card className="border-l-4 border-l-amber-500 hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Locked Balance
              </CardTitle>
              <CardAction>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                  <Lock className="h-5 w-5 text-amber-500" />
                </div>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">
                  R {(shopStats?.wallet_locked_balance ?? shopStats?.locked_balance ?? 0).toLocaleString(
                  undefined,
                  {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }
                  )}
              </div>
              <p className="text-xs text-muted-foreground">
                Pending delivery confirmation
              </p>
            </CardContent>
          </Card>
          </Link>
          {/* <Card className="border-l-4 border-l-chart-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Listings
              </CardTitle>
              <CardAction>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/10">
                  <Package className="h-5 w-5 text-chart-2" />
                </div>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {(originalParts.filter(p => p.status === 'active').length + refurbishedParts.filter(p => p.status === 'active').length)}
              </div>
              <p className="text-xs text-muted-foreground">
                {originalParts.length + refurbishedParts.length} total parts listed
              </p>
            </CardContent>
          </Card> */}
          <Card className="border-l-4 border-l-chart-3">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Views
              </CardTitle>
              <CardAction>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-3/10">
                  <Eye className="h-5 w-5 text-chart-3" />
                </div>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {(originalParts.reduce((sum, part) => sum + part.views, 0) + refurbishedParts.reduce((sum, part) => sum + part.views, 0)).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {shopStats?.customer_satisfaction ? `${shopStats.customer_satisfaction}% satisfaction` : 'Across all parts'}
              </p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-chart-4">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Refurbished Sold
              </CardTitle>
              <CardAction>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/10">
                  <Wrench className="h-5 w-5 text-chart-4" />
                </div>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {refurbishedParts.filter(p => p.status === 'sold').length}
              </div>
              <p className="text-xs text-muted-foreground">
                {refurbishedParts.length > 0 
                  ? `${refurbishedParts.length} total refurbished parts`
                  : 'No refurbished parts yet'
                }
              </p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer hover:bg-muted/70 transition-colors border-l-4 ${
              ficaStatus?.fica_status === "verified"
                ? "border-l-emerald-500"
                : "border-l-red-500"
            }`}
            onClick={() => setShowFicaModal(true)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                FICA Status
              </CardTitle>
              <CardAction>
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                    ficaStatus?.fica_status === "verified"
                      ? "bg-emerald-50"
                      : "bg-red-50"
                  }`}
                >
                  <FileText
                    className={`h-5 w-5 ${
                      ficaStatus?.fica_status === "verified"
                        ? "text-emerald-600"
                        : "text-red-600"
                    }`}
                  />
                </div>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <Badge variant={
                  ficaStatus?.fica_status === 'verified' ? 'default' :
                  ficaStatus?.fica_status === 'pending' ? 'secondary' :
                  ficaStatus?.fica_status === 'rejected' ? 'destructive' : 'outline'
                }>
                  {ficaStatus?.fica_status === 'verified' ? 'Verified' :
                   ficaStatus?.fica_status === 'pending' ? 'Pending' :
                   ficaStatus?.fica_status === 'rejected' ? 'Rejected' : 'Not Started'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {documents.length}/3 documents uploaded
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="parts" className="space-y-4">
          {/* Top tab navigation */}
          <div className="flex justify-center">
            <TabsList className="inline-flex items-center gap-6 rounded-full bg-muted px-4 py-1 text-muted-foreground">
            <TabsTrigger
              value="parts"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border data-[state=inactive]:border-transparent data-[state=inactive]:shadow-none data-[state=inactive]:bg-transparent"
            >
              Parts
            </TabsTrigger>
            <TabsTrigger
              value="interactions"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border data-[state=inactive]:border-transparent data-[state=inactive]:shadow-none data-[state=inactive]:bg-transparent"
            >
              Interactions
            </TabsTrigger>
            <TabsTrigger
              value="shop"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border data-[state=inactive]:border-transparent data-[state=inactive]:shadow-none data-[state=inactive]:bg-transparent"
            >
              Shop Management
            </TabsTrigger>
          </TabsList>
          </div>

          {/* Parts Tab */}
          <TabsContent value="parts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Your Parts Listings</CardTitle>
                <CardDescription className="mt-1">
                  Manage your electronic parts inventory and listings
                </CardDescription>
                <div className="space-y-4">
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
                        <TableHead>Type</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Views</TableHead>
                        <TableHead>Saves</TableHead>
                        <TableHead>Chats</TableHead>
                        <TableHead>MOQ</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAllParts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={11}>
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                                <Package className="h-8 w-8 text-primary" />
                              </div>
                              <h3 className="mb-2 text-lg font-semibold">
                                {(originalParts.length + refurbishedParts.length) === 0
                                  ? "No parts found"
                                  : "No parts match your current filters"}
                              </h3>
                              <p className="mb-4 text-sm text-muted-foreground">
                                {(originalParts.length + refurbishedParts.length) === 0
                                  ? "Get started by adding your first part to the marketplace"
                                  : "Try adjusting your search criteria to see more results"}
                              </p>
                              <Button asChild className="bg-primary hover:bg-primary/90">
                                <Link href="/sell">
                                  <Plus className="mr-2 h-4 w-4" />
                                  {(originalParts.length + refurbishedParts.length) === 0
                                    ? "Add your first part"
                                    : "Add a new part"}
                                </Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAllParts.map((part) => (
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
                              <div className="flex items-center space-x-1">
                                <MessageCircle className="h-4 w-4 text-blue-500" />
                                <span>{partInteractions[part.id]?.chats || 0}</span>
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* Interactions Tab */}
          <TabsContent value="interactions" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <MessageCircle className="mr-2 h-5 w-5" />
                    Recent Chats
                  </CardTitle>
                  <CardDescription>Customer inquiries about your parts</CardDescription>
                </CardHeader>
                <CardContent>
                  {sellerChats.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No chats yet. Customers will appear here when they message you about your parts.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sellerChats.slice(0, 5).map((chat) => (
                        <div key={chat.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium">{chat.partName}</div>
                            <div className="text-sm text-muted-foreground">
                              From: {chat.buyerName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(chat.lastMessageAt).toLocaleDateString()}
                            </div>
                          </div>
                          <Button size="sm" variant="outline">
                            View Chat
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Heart className="mr-2 h-5 w-5" />
                    Most Saved Parts
                  </CardTitle>
                  <CardDescription>Your parts that customers have saved</CardDescription>
                </CardHeader>
                <CardContent>
                  {Object.keys(partInteractions).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No saves yet. Track which parts customers are interested in.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(partInteractions)
                        .filter(([_, interactions]) => interactions.saves > 0)
                        .sort(([_, a], [__, b]) => b.saves - a.saves)
                        .slice(0, 5)
                        .map(([partId, interactions]) => {
                          const part = [...originalParts, ...refurbishedParts].find(p => p.id === partId)
                          if (!part) return null
                          
                          return (
                            <div key={partId} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex-1">
                                <div className="font-medium">{part.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {interactions.saves} saves • {interactions.views} views
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Heart className="h-4 w-4 text-red-500" />
                                <span className="font-medium">{interactions.saves}</span>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Eye className="mr-2 h-5 w-5" />
                  Part Performance Overview
                </CardTitle>
                <CardDescription>Views, saves, and chats across all your parts</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Part Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Views</TableHead>
                      <TableHead>Saves</TableHead>
                      <TableHead>Chats</TableHead>
                      <TableHead>Recent Views (7d)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...originalParts, ...refurbishedParts]
                      .sort((a, b) => (partInteractions[b.id]?.views || 0) - (partInteractions[a.id]?.views || 0))
                      .slice(0, 10)
                      .map((part) => (
                        <TableRow key={part.id}>
                          <TableCell className="font-medium">{part.name}</TableCell>
                          <TableCell>
                            <Badge variant={
                              part.status === "active" ? "default" : 
                              part.status === "out_of_stock" ? "destructive" : 
                              "secondary"
                            }>
                              {part.status === "active" ? "Active" : 
                               part.status === "out_of_stock" ? "Out of Stock" :
                               part.status === "draft" ? "Draft" :
                               part.status === "inactive" ? "Inactive" : "Sold"}
                            </Badge>
                          </TableCell>
                          <TableCell>{partInteractions[part.id]?.views || 0}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-1">
                              <Heart className="h-4 w-4 text-red-500" />
                              <span>{partInteractions[part.id]?.saves || 0}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-1">
                              <MessageCircle className="h-4 w-4 text-blue-500" />
                              <span>{partInteractions[part.id]?.chats || 0}</span>
                            </div>
                          </TableCell>
                          <TableCell>{partInteractions[part.id]?.recentViews || 0}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Shop Management Tab */}
          <TabsContent value="shop" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Store className="mr-2 h-5 w-5" />
                    Shop Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium">Shop Name</h4>
                    <p className="text-sm text-muted-foreground">
                      {shopStats?.name || 'No shop name set'}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium">Shop Description</h4>
                    <p className="text-sm text-muted-foreground">
                      {shopStats?.description || 'No description provided'}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium">Rating</h4>
                    <p className="text-sm text-muted-foreground">
                      {shopStats?.rating ? `${shopStats.rating}/5 (${shopStats.review_count} reviews)` : 'No ratings yet'}
                    </p>
                  </div>
                  <Button asChild className="w-full">
                    <Link href="/profile">Edit Shop Profile</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="mr-2 h-5 w-5" />
                    Performance Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-sm">Conversion Rate</span>
                    <span className="text-sm font-medium">
                      {shopStats?.conversion_rate ? `${shopStats.conversion_rate}%` : '0%'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Avg. Response Time</span>
                    <span className="text-sm font-medium">
                      {shopStats?.avg_response_time_hours ? `${shopStats.avg_response_time_hours}h` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Customer Satisfaction</span>
                    <span className="text-sm font-medium">
                      {shopStats?.customer_satisfaction ? `${shopStats.customer_satisfaction}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Repeat Customers</span>
                    <span className="text-sm font-medium">
                      {shopStats?.repeat_customer_rate ? `${shopStats.repeat_customer_rate}%` : '0%'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

          </TabsContent>
        </Tabs>
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
                  {/* Show additional images if available */}
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

      {/* FICA Status Modal */}
      <Dialog open={showFicaModal} onOpenChange={setShowFicaModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>FICA Verification Status</DialogTitle>
            <DialogDescription>
              Manage your FICA document verification for selling on the platform
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h3 className="font-medium">Current Status</h3>
                <p className="text-sm text-muted-foreground">
                  {ficaStatus?.fica_status === 'verified' ? 'Your FICA documents have been verified' :
                   ficaStatus?.fica_status === 'pending' ? 'Your FICA documents are under review' :
                   ficaStatus?.fica_status === 'rejected' ? 'Your FICA documents were rejected' :
                   'FICA verification not started'}
                </p>
                {ficaStatus?.fica_rejection_reason && (
                  <p className="text-sm text-red-600 mt-1">
                    Reason: {ficaStatus.fica_rejection_reason}
                  </p>
                )}
              </div>
              <Badge variant={
                ficaStatus?.fica_status === 'verified' ? 'default' :
                ficaStatus?.fica_status === 'pending' ? 'secondary' :
                ficaStatus?.fica_status === 'rejected' ? 'destructive' : 'outline'
              }>
                {ficaStatus?.fica_status === 'verified' ? 'Verified' :
                 ficaStatus?.fica_status === 'pending' ? 'Pending' :
                 ficaStatus?.fica_status === 'rejected' ? 'Rejected' : 'Not Started'}
              </Badge>
            </div>

            <FicaUpload />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
