"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  Search,
  MoreHorizontal,
  Eye,
  Package,
  RefreshCw,
  Truck,
  CreditCard,
  Clock,
  CheckCircle,
  AlertTriangle,
  MapPin,
  ExternalLink,
  Save,
  Lock,
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
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/hooks/use-auth"
import { createClient } from "@/utils/supabase/client"

interface OrderItem {
  id: string
  part_id: string
  quantity: number
  unit_price: number
  total_price: number
  parts: {
    id: string
    name: string
    image_url: string | null
    images: string[] | null
    category: string
  } | null
}

interface Transaction {
  id: string
  amount: number
  commission_amount: number
  seller_amount: number
  status: string
  escrow_status: "held" | "released" | "refunded" | "disputed"
}

interface Order {
  id: string
  order_number: string
  customer_id: string | null
  customer_email: string
  customer_name: string
  customer_phone: string | null
  status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded"
  payment_status: "pending" | "paid" | "failed" | "refunded"
  total_amount: number
  subtotal: number
  tax_amount: number
  shipping_amount: number
  discount_amount: number
  shipping_address: {
    firstName?: string
    lastName?: string
    address?: string
    city?: string
    state?: string
    zipCode?: string
    country?: string
  } | null
  billing_address: any
  payment_method: string | null
  customer_notes: string | null
  internal_notes: string | null
  tracking_number: string | null
  carrier: string | null
  tracking_url: string | null
  created_at: string
  updated_at: string
  shipped_at: string | null
  delivered_at: string | null
  order_items: OrderItem[]
  transactions: Transaction[]
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmed: "bg-blue-100 text-blue-800 border-blue-200",
  processing: "bg-purple-100 text-purple-800 border-purple-200",
  shipped: "bg-indigo-100 text-indigo-800 border-indigo-200",
  delivered: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
  refunded: "bg-gray-100 text-gray-800 border-gray-200",
}

const paymentStatusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  paid: "bg-green-100 text-green-800 border-green-200",
  failed: "bg-red-100 text-red-800 border-red-200",
  refunded: "bg-gray-100 text-gray-800 border-gray-200",
}

const escrowStatusColors: Record<string, string> = {
  held: "bg-amber-100 text-amber-800 border-amber-200",
  released: "bg-emerald-100 text-emerald-800 border-emerald-200",
  refunded: "bg-gray-100 text-gray-800 border-gray-200",
  disputed: "bg-red-100 text-red-800 border-red-200",
}

const escrowStatusLabels: Record<string, string> = {
  held: "Held",
  released: "Released",
  refunded: "Refunded",
  disputed: "Disputed",
}

const carriers = [
  "FedEx",
  "UPS",
  "DHL",
  "Postal Service",
  "The Courier Guy",
  "Aramex",
  "Dawn Wing",
  "RAM Hand to Hand",
  "Fastway",
  "Other",
]

// Define status progression - sellers can only move forward
const statusProgression: Record<string, string[]> = {
  'confirmed': ['confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
  'processing': ['processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
  'shipped': ['shipped', 'delivered', 'cancelled', 'refunded'],
  'delivered': ['delivered', 'refunded'],
  'cancelled': ['cancelled'],
  'refunded': ['refunded'],
}

const statusLabels: Record<string, string> = {
  'confirmed': 'Confirmed',
  'processing': 'Processing',
  'shipped': 'Shipped',
  'delivered': 'Delivered',
  'cancelled': 'Cancelled',
  'refunded': 'Refunded',
}

export default function TransactionsPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [paymentFilter, setPaymentFilter] = useState("all")
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  
  // Edit form state
  const [editStatus, setEditStatus] = useState("")
  const [editNotes, setEditNotes] = useState("")
  const [editTrackingNumber, setEditTrackingNumber] = useState("")
  const [editCarrier, setEditCarrier] = useState("")
  const [editTrackingUrl, setEditTrackingUrl] = useState("")
  
  const { user } = useAuth()
  const supabase = createClient()

  // Fetch orders
  const fetchOrders = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      const params = new URLSearchParams()
      if (statusFilter !== "all") params.set("status", statusFilter)
      if (paymentFilter !== "all") params.set("payment_status", paymentFilter)
      if (searchTerm) params.set("search", searchTerm)

      const response = await fetch(`/api/seller/orders?${params.toString()}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch orders")
      }

      setOrders(data.orders || [])
    } catch (err: any) {
      console.error("Error fetching orders:", err)
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchOrders()
    }
  }, [user, statusFilter, paymentFilter])

  // Handle search with debounce
  useEffect(() => {
    if (!user) return
    
    const timer = setTimeout(() => {
      fetchOrders()
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Open order details modal
  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order)
    setEditStatus(order.status)
    setEditNotes(order.internal_notes || "")
    setEditTrackingNumber(order.tracking_number || "")
    setEditCarrier(order.carrier || "")
    setEditTrackingUrl(order.tracking_url || "")
    setIsDetailsModalOpen(true)
  }

  // Update order
  const handleUpdateOrder = async () => {
    if (!selectedOrder) return

    try {
      setIsUpdating(true)
      setError(null)

      const updateData: Record<string, any> = {}

      if (editStatus !== selectedOrder.status) {
        updateData.status = editStatus
      }
      if (editNotes !== (selectedOrder.internal_notes || "")) {
        updateData.internal_notes = editNotes
      }
      if (editTrackingNumber !== (selectedOrder.tracking_number || "")) {
        updateData.tracking_number = editTrackingNumber
      }
      if (editCarrier !== (selectedOrder.carrier || "")) {
        updateData.carrier = editCarrier
      }
      if (editTrackingUrl !== (selectedOrder.tracking_url || "")) {
        updateData.tracking_url = editTrackingUrl
      }

      // Only make API call if there are changes
      if (Object.keys(updateData).length === 0) {
        setIsDetailsModalOpen(false)
        return
      }

      const response = await fetch(`/api/seller/orders/${selectedOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update order")
      }

      // Update local state
      setOrders(orders.map(o => o.id === selectedOrder.id ? data.order : o))
      setSelectedOrder(data.order)
      setIsDetailsModalOpen(false)
    } catch (err: any) {
      console.error("Error updating order:", err)
      setError(err.message)
    } finally {
      setIsUpdating(false)
    }
  }

  // Calculate stats
  const stats = useMemo(() => {
    const totalOrders = orders.length
    const newOrders = orders.filter(o => o.status === "confirmed").length
    const processingOrders = orders.filter(o => o.status === "processing" || o.status === "shipped").length
    const completedOrders = orders.filter(o => o.status === "delivered").length
    const totalRevenue = orders
      .filter(o => o.payment_status === "paid")
      .reduce((sum, o) => sum + o.total_amount, 0)
    const totalEarnings = orders
      .filter(o => o.payment_status === "paid" && o.transactions?.[0]?.seller_amount)
      .reduce((sum, o) => sum + (o.transactions[0]?.seller_amount || 0), 0)
    
    // Calculate held vs released earnings
    const heldEarnings = orders
      .filter(o => o.payment_status === "paid" && o.transactions?.[0]?.escrow_status === "held")
      .reduce((sum, o) => sum + (o.transactions[0]?.seller_amount || 0), 0)
    const releasedEarnings = orders
      .filter(o => o.payment_status === "paid" && o.transactions?.[0]?.escrow_status === "released")
      .reduce((sum, o) => sum + (o.transactions[0]?.seller_amount || 0), 0)

    return { totalOrders, newOrders, processingOrders, completedOrders, totalRevenue, totalEarnings, heldEarnings, releasedEarnings }
  }, [orders])

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch = searchTerm === "" ||
        order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer_email?.toLowerCase().includes(searchTerm.toLowerCase())

      return matchesSearch
    })
  }, [orders, searchTerm])

  const clearFilters = () => {
    setSearchTerm("")
    setStatusFilter("all")
    setPaymentFilter("all")
  }

  // Show loading state
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading transactions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-background via-background to-secondary/20">
      <main className="container mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {/* Header */}
        <div className="mb-2 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Transactions</h2>
            <p className="text-muted-foreground mt-1">
              Manage customer orders and update shipping information
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => fetchOrders(true)}
              variant="outline"
              size="default"
              disabled={refreshing}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Orders
              </CardTitle>
              <CardAction>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Package className="h-5 w-5 text-primary" />
                </div>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalOrders}</div>
              <p className="text-xs text-muted-foreground">All time orders</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                New Orders
              </CardTitle>
              <CardAction>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                  <Clock className="h-5 w-5 text-blue-600" />
                </div>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.newOrders}</div>
              <p className="text-xs text-muted-foreground">Confirmed orders</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Processing
              </CardTitle>
              <CardAction>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                  <Truck className="h-5 w-5 text-purple-600" />
                </div>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.processingOrders}</div>
              <p className="text-xs text-muted-foreground">In transit</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Completed
              </CardTitle>
              <CardAction>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.completedOrders}</div>
              <p className="text-xs text-muted-foreground">Delivered</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Released Earnings
              </CardTitle>
              <CardAction>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                  <CreditCard className="h-5 w-5 text-emerald-600" />
                </div>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                R {stats.releasedEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">Available after delivery</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Held in Escrow
              </CardTitle>
              <CardAction>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                  <Lock className="h-5 w-5 text-amber-600" />
                </div>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                R {stats.heldEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">Pending delivery</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardHeader>
            <CardTitle>Orders</CardTitle>
            <CardDescription>View and manage all customer orders</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 md:flex-row md:items-end mb-6">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Order Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="refunded">Refunded</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Payment Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Payments</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="refunded">Refunded</SelectItem>
                  </SelectContent>
                </Select>
                {(searchTerm || statusFilter !== "all" || paymentFilter !== "all") && (
                  <Button variant="ghost" onClick={clearFilters} size="sm">
                    Clear Filters
                  </Button>
                )}
              </div>
            </div>

            {/* Orders Table */}
            {filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">No orders found</h3>
                <p className="text-muted-foreground">
                  {orders.length === 0 
                    ? "You haven't received any orders yet."
                    : "No orders match your current filters."}
                </p>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Escrow</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Net Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <div className="font-medium">{order.order_number}</div>
                          <div className="text-sm text-muted-foreground">
                            {order.order_items.length} item{order.order_items.length !== 1 ? 's' : ''}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{order.customer_name || 'Guest'}</div>
                          <div className="text-sm text-muted-foreground">{order.customer_email}</div>
                        </TableCell>
                        <TableCell>
                          <div>{new Date(order.created_at).toLocaleDateString()}</div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(order.created_at).toLocaleTimeString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[order.status]} variant="outline">
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={paymentStatusColors[order.payment_status]} variant="outline">
                            {order.payment_status.charAt(0).toUpperCase() + order.payment_status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {order.transactions?.[0]?.escrow_status ? (
                            <Badge className={escrowStatusColors[order.transactions[0].escrow_status]} variant="outline">
                              {escrowStatusLabels[order.transactions[0].escrow_status] || order.transactions[0].escrow_status}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          R {order.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {order.transactions?.[0]?.seller_amount != null ? (
                            `R ${order.transactions[0].seller_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                          ) : (
                            <span className="text-muted-foreground">-</span>
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
                              <DropdownMenuItem onClick={() => handleViewOrder(order)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Order Details Modal */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order {selectedOrder?.order_number}</DialogTitle>
            <DialogDescription>
              View and update order details
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6">
              {/* Order Status, Payment, and Escrow */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Order Status</Label>
                  <Badge className={`${statusColors[selectedOrder.status]} mt-1`} variant="outline">
                    {selectedOrder.status.charAt(0).toUpperCase() + selectedOrder.status.slice(1)}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Payment Status</Label>
                  <Badge className={`${paymentStatusColors[selectedOrder.payment_status]} mt-1`} variant="outline">
                    {selectedOrder.payment_status.charAt(0).toUpperCase() + selectedOrder.payment_status.slice(1)}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Escrow Status</Label>
                  {selectedOrder.transactions?.[0]?.escrow_status ? (
                    <Badge className={`${escrowStatusColors[selectedOrder.transactions[0].escrow_status]} mt-1`} variant="outline">
                      {escrowStatusLabels[selectedOrder.transactions[0].escrow_status] || selectedOrder.transactions[0].escrow_status}
                    </Badge>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">-</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Customer Information */}
              <div>
                <h4 className="font-medium mb-3">Customer Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Name</Label>
                    <p className="font-medium">{selectedOrder.customer_name || 'Guest'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="font-medium">{selectedOrder.customer_email}</p>
                  </div>
                  {selectedOrder.customer_phone && (
                    <div>
                      <Label className="text-muted-foreground">Phone</Label>
                      <p className="font-medium">{selectedOrder.customer_phone}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Shipping Address */}
              {selectedOrder.shipping_address && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Shipping Address
                  </h4>
                  <div className="text-sm bg-muted/50 rounded-lg p-3">
                    <p>{selectedOrder.shipping_address.firstName} {selectedOrder.shipping_address.lastName}</p>
                    <p>{selectedOrder.shipping_address.address}</p>
                    <p>{selectedOrder.shipping_address.city}, {selectedOrder.shipping_address.state} {selectedOrder.shipping_address.zipCode}</p>
                    <p>{selectedOrder.shipping_address.country}</p>
                  </div>
                </div>
              )}

              <Separator />

              {/* Order Items */}
              <div>
                <h4 className="font-medium mb-3">Order Items</h4>
                <div className="space-y-3">
                  {selectedOrder.order_items.map((item) => (
                    <div key={item.id} className="flex items-center gap-4 bg-muted/50 rounded-lg p-3">
                      <div className="relative h-16 w-16 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                        {(item.parts?.images?.[0] || item.parts?.image_url) ? (
                          <Image
                            src={item.parts?.images?.[0] || item.parts?.image_url || ''}
                            alt={item.parts?.name || 'Product'}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <Package className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.parts?.name || 'Unknown Product'}</p>
                        <p className="text-sm text-muted-foreground">{item.parts?.category}</p>
                        <p className="text-sm">Qty: {item.quantity} × R {item.unit_price.toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">R {item.total_price.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Totals */}
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>R {selectedOrder.subtotal.toFixed(2)}</span>
                  </div>
                  {selectedOrder.shipping_amount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shipping</span>
                      <span>R {selectedOrder.shipping_amount.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedOrder.tax_amount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax</span>
                      <span>R {selectedOrder.tax_amount.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedOrder.discount_amount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>-R {selectedOrder.discount_amount.toFixed(2)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-medium text-base">
                    <span>Order Total</span>
                    <span>R {selectedOrder.total_amount.toFixed(2)}</span>
                  </div>
                  {selectedOrder.transactions?.[0] && (
                    <>
                      <Separator />
                      <div className="flex justify-between text-muted-foreground">
                        <span>Platform Fee</span>
                        <span>-R {selectedOrder.transactions[0].commission_amount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-medium text-base text-green-600">
                        <span>Your Earnings</span>
                        <span>R {selectedOrder.transactions[0].seller_amount.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Customer Notes */}
              {selectedOrder.customer_notes && (
                <div>
                  <Label className="text-muted-foreground">Customer Notes</Label>
                  <p className="text-sm mt-1 bg-muted/50 rounded-lg p-3">{selectedOrder.customer_notes}</p>
                </div>
              )}

              <Separator />

              {/* Update Section */}
              <div>
                <h4 className="font-medium mb-4">Update Order</h4>
                
                <div className="space-y-4">
                  {/* Status Update */}
                  <div>
                    <Label htmlFor="status">Order Status</Label>
                    <Select value={editStatus} onValueChange={setEditStatus}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(statusProgression[selectedOrder.status] || []).map((status) => (
                          <SelectItem key={status} value={status}>
                            {statusLabels[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Orders can only progress forward in status
                    </p>
                  </div>

                  {/* Tracking Information */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="carrier">Carrier</Label>
                      <Select value={editCarrier} onValueChange={setEditCarrier}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select carrier" />
                        </SelectTrigger>
                        <SelectContent>
                          {carriers.map((carrier) => (
                            <SelectItem key={carrier} value={carrier}>{carrier}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="tracking">Tracking Number</Label>
                      <Input
                        id="tracking"
                        value={editTrackingNumber}
                        onChange={(e) => setEditTrackingNumber(e.target.value)}
                        placeholder="Enter tracking number"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="trackingUrl">Tracking URL (Optional)</Label>
                    <Input
                      id="trackingUrl"
                      value={editTrackingUrl}
                      onChange={(e) => setEditTrackingUrl(e.target.value)}
                      placeholder="https://..."
                      className="mt-1"
                    />
                  </div>

                  {/* Display current tracking info if exists */}
                  {selectedOrder.tracking_number && (
                    <div className="bg-blue-50 rounded-lg p-3 text-sm">
                      <p className="font-medium text-blue-800">Current Tracking Info</p>
                      <p className="text-blue-700">
                        {selectedOrder.carrier}: {selectedOrder.tracking_number}
                        {selectedOrder.tracking_url && (
                          <a 
                            href={selectedOrder.tracking_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="ml-2 inline-flex items-center hover:underline"
                          >
                            Track <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                        )}
                      </p>
                    </div>
                  )}

                  {/* Internal Notes */}
                  <div>
                    <Label htmlFor="notes">Internal Notes</Label>
                    <Textarea
                      id="notes"
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Add notes for your reference (not visible to customer)"
                      rows={3}
                      className="mt-1"
                    />
                  </div>

                  {/* Timestamps */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-muted-foreground">Created</Label>
                      <p>{new Date(selectedOrder.created_at).toLocaleString()}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Last Updated</Label>
                      <p>{new Date(selectedOrder.updated_at).toLocaleString()}</p>
                    </div>
                    {selectedOrder.shipped_at && (
                      <div>
                        <Label className="text-muted-foreground">Shipped</Label>
                        <p>{new Date(selectedOrder.shipped_at).toLocaleString()}</p>
                      </div>
                    )}
                    {selectedOrder.delivered_at && (
                      <div>
                        <Label className="text-muted-foreground">Delivered</Label>
                        <p>{new Date(selectedOrder.delivered_at).toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsDetailsModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateOrder} disabled={isUpdating}>
                  {isUpdating ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

