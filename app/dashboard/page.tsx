"use client"

import { useState, useEffect } from "react"
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
  DollarSign,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CartButton } from "@/components/cart-button"
import { useShop } from "@/hooks/use-shop"
import { useAuth } from "@/hooks/use-auth"

export default function DashboardPage() {
  const [searchTerm, setSearchTerm] = useState("")
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

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  // Show loading state while checking authentication
  if (authLoading || loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <header className="px-4 lg:px-6 h-14 flex items-center border-b bg-white">
          <Link className="flex items-center justify-center" href="/">
            <Cpu className="h-6 w-6 mr-2 text-blue-600" />
            <span className="font-bold text-xl">Ibalilam</span>
          </Link>
        </header>
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
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="px-4 lg:px-6 h-14 flex items-center border-b bg-white">
        <Link className="flex items-center justify-center" href="/">
          <Cpu className="h-6 w-6 mr-2 text-blue-600" />
          <span className="font-bold text-xl">Ibalilam</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6 items-center">
          <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/parts">
            Browse Parts
          </Link>
          <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/dashboard">
            Dashboard
          </Link>
          <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/profile">
            Profile
          </Link>
          <CartButton />
        </nav>
      </header>

      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <div className="flex items-center space-x-2">
            <Button 
              onClick={refreshData} 
              variant="outline" 
              size="sm"
              disabled={refreshing}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button asChild>
              <Link href="/sell">
                <Plus className="mr-2 h-4 w-4" />
                Add New Part
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${shopStats?.total_sales?.toLocaleString() || '0'}
              </div>
              <p className="text-xs text-muted-foreground">
                {shopStats?.conversion_rate ? `${shopStats.conversion_rate}% conversion rate` : 'No sales yet'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Listings</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{shopStats?.active_listings || 0}</div>
              <p className="text-xs text-muted-foreground">
                {originalParts.length + refurbishedParts.length} total parts
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Views</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{shopStats?.total_views?.toLocaleString() || '0'}</div>
              <p className="text-xs text-muted-foreground">
                {shopStats?.customer_satisfaction ? `${shopStats.customer_satisfaction}% satisfaction` : 'No views yet'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Refurbished Sold</CardTitle>
              <Wrench className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{shopStats?.refurbished_sold || 0}</div>
              <p className="text-xs text-muted-foreground">
                {refurbishedParts.filter(p => p.status === 'sold').length} sold this period
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="original" className="space-y-4">
          <TabsList>
            <TabsTrigger value="original">Original Parts</TabsTrigger>
            <TabsTrigger value="refurbished">Refurbished Parts</TabsTrigger>
            <TabsTrigger value="shop">Shop Management</TabsTrigger>
          </TabsList>

          {/* Original Parts Tab */}
          <TabsContent value="original" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Your Original Parts Listings</CardTitle>
                <CardDescription>Manage your electronic parts inventory and listings</CardDescription>
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search parts..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <Button variant="outline" size="sm">
                    <Filter className="mr-2 h-4 w-4" />
                    Filter
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Views</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {originalParts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No original parts found. <Link href="/sell" className="text-blue-600 hover:underline">Add your first part</Link>
                        </TableCell>
                      </TableRow>
                    ) : (
                      originalParts.map((part) => (
                        <TableRow key={part.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center space-x-3">
                              <Image
                                src={part.image_url || "/placeholder.svg"}
                                alt={part.name}
                                width={40}
                                height={40}
                                className="rounded-md"
                              />
                              <span>{part.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>{part.category}</TableCell>
                          <TableCell>${part.price.toFixed(2)}</TableCell>
                          <TableCell>{part.stock_quantity}</TableCell>
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
                          <TableCell>{part.views}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600">
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* Refurbished Parts Tab */}
          <TabsContent value="refurbished" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Refurbished Parts</CardTitle>
                <CardDescription>Track your refurbishment projects and their profitability</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Original Condition</TableHead>
                      <TableHead>Refurbished Condition</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Profit</TableHead>
                      <TableHead>Time Spent</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {refurbishedParts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          No refurbished parts found. <Link href="/sell" className="text-blue-600 hover:underline">Add your first refurbished part</Link>
                        </TableCell>
                      </TableRow>
                    ) : (
                      refurbishedParts.map((part) => (
                        <TableRow key={part.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center space-x-3">
                              <Image
                                src={part.image_url || "/placeholder.svg"}
                                alt={part.name}
                                width={40}
                                height={40}
                                className="rounded-md"
                              />
                              <span>{part.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="destructive">{part.original_condition || 'Unknown'}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="default">{part.refurbished_condition || 'Unknown'}</Badge>
                          </TableCell>
                          <TableCell>${part.cost?.toFixed(2) || '0.00'}</TableCell>
                          <TableCell>${part.price.toFixed(2)}</TableCell>
                          <TableCell className="text-green-600 font-medium">
                            +${part.profit?.toFixed(2) || '0.00'}
                          </TableCell>
                          <TableCell>{part.time_spent_hours ? `${part.time_spent_hours}h` : 'N/A'}</TableCell>
                          <TableCell>
                            <Badge variant={
                              part.status === "active" ? "default" : 
                              part.status === "sold" ? "secondary" : 
                              "destructive"
                            }>
                              {part.status === "active" ? "Active" : 
                               part.status === "sold" ? "Sold" :
                               part.status === "draft" ? "Draft" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Listing
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
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

            <Card>
              <CardHeader>
                <CardTitle>Recent Orders</CardTitle>
                <CardDescription>Your latest customer orders and their status</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No orders yet. Start selling to see your orders here!
                        </TableCell>
                      </TableRow>
                    ) : (
                      recentOrders.map((order) => (
                        <TableRow key={order.order_id}>
                          <TableCell className="font-medium">{order.order_number}</TableCell>
                          <TableCell>{order.customer_name || 'Guest'}</TableCell>
                          <TableCell>{order.product_name || 'Multiple items'}</TableCell>
                          <TableCell>${order.amount.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant={
                              order.status === 'shipped' ? 'default' :
                              order.status === 'delivered' ? 'default' :
                              order.status === 'processing' ? 'secondary' :
                              order.status === 'pending' ? 'outline' :
                              order.status === 'cancelled' ? 'destructive' : 'secondary'
                            }>
                              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
