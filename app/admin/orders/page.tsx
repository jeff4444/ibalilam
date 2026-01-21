'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { fetchWithCsrf } from '@/lib/csrf-client'
import { 
  ShoppingCart, 
  Search, 
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Clock,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  CreditCard,
  MapPin
} from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

interface OrderItem {
  id: string
  quantity: number
  unit_price: number
  total_price: number
  part_name: string
}

interface Order {
  id: string
  order_number: string
  shop_id: string
  customer_id?: string
  customer_name?: string
  customer_email?: string
  customer_phone?: string
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded'
  payment_method?: string
  total_amount: number
  subtotal: number
  tax_amount: number
  shipping_amount: number
  discount_amount: number
  shipping_address?: any
  created_at: string
  updated_at: string
  shipped_at?: string
  delivered_at?: string
  shop_name: string
  items: OrderItem[]
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function AdminOrdersPage() {
  const searchParams = useSearchParams()
  const initialStatus = searchParams.get('status') || 'all'
  
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState(initialStatus)
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [statusCounts, setStatusCounts] = useState({ pending: 0, processing: 0, shipped: 0, delivered: 0 })

  useEffect(() => {
    fetchStatusCounts()
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [searchTerm, statusFilter, paymentFilter, pagination.page])

  const fetchStatusCounts = async () => {
    try {
      // Fetch all orders to get accurate status counts
      const response = await fetch('/api/admin/orders?limit=1000')
      const data = await response.json()
      
      if (response.ok && data.orders) {
        setStatusCounts({
          pending: data.orders.filter((o: Order) => o.status === 'pending').length,
          processing: data.orders.filter((o: Order) => o.status === 'processing').length,
          shipped: data.orders.filter((o: Order) => o.status === 'shipped').length,
          delivered: data.orders.filter((o: Order) => o.status === 'delivered').length
        })
      }
    } catch (error) {
      console.error('Error fetching status counts:', error)
    }
  }

  const fetchOrders = async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      })
      
      if (searchTerm) params.set('search', searchTerm)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (paymentFilter !== 'all') params.set('payment_status', paymentFilter)

      const response = await fetch(`/api/admin/orders?${params}`)
      const data = await response.json()
      
      if (response.ok) {
        setOrders(data.orders)
        setPagination(prev => ({ ...prev, ...data.pagination }))
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async () => {
    if (!selectedOrder || !newStatus) return

    try {
      setIsProcessing(true)

      const response = await fetchWithCsrf('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: selectedOrder.id,
          action: 'update_status',
          status: newStatus
        })
      })

      if (response.ok) {
        setShowUpdateModal(false)
        setSelectedOrder(null)
        setNewStatus('')
        fetchOrders()
        fetchStatusCounts()
      }
    } catch (error) {
      console.error('Error updating order:', error)
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
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pending</Badge>
      case 'confirmed':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Confirmed</Badge>
      case 'processing':
        return <Badge className="bg-indigo-500/20 text-indigo-400 border-indigo-500/30">Processing</Badge>
      case 'shipped':
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Shipped</Badge>
      case 'delivered':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Delivered</Badge>
      case 'cancelled':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Cancelled</Badge>
      case 'refunded':
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">Refunded</Badge>
      default:
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">{status}</Badge>
    }
  }

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Paid</Badge>
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pending</Badge>
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Failed</Badge>
      case 'refunded':
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">Refunded</Badge>
      default:
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">{status}</Badge>
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />
      case 'confirmed':
      case 'processing':
        return <Package className="h-5 w-5 text-blue-500" />
      case 'shipped':
        return <Truck className="h-5 w-5 text-purple-500" />
      case 'delivered':
        return <CheckCircle className="h-5 w-5 text-emerald-500" />
      case 'cancelled':
      case 'refunded':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <Clock className="h-5 w-5 text-slate-500" />
    }
  }

  const pendingOrders = statusCounts.pending
  const processingOrders = statusCounts.processing
  const shippedOrders = statusCounts.shipped
  const deliveredOrders = statusCounts.delivered

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Orders</h1>
          <p className="text-slate-400 mt-1">Manage platform orders and shipments</p>
        </div>
        <Button onClick={fetchOrders} variant="outline" className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700 hover:border-slate-500 hover:text-white">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <ShoppingCart className="h-8 w-8 text-slate-400" />
              <div>
                <p className="text-2xl font-bold text-white">{pagination.total}</p>
                <p className="text-sm text-slate-400">Total Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`bg-slate-900 border-slate-800 cursor-pointer transition-all hover:border-yellow-500/50 ${statusFilter === 'pending' ? 'border-yellow-500' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Clock className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold text-white">{pendingOrders}</p>
                <p className="text-sm text-slate-400">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`bg-slate-900 border-slate-800 cursor-pointer transition-all hover:border-blue-500/50 ${statusFilter === 'processing' ? 'border-blue-500' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'processing' ? 'all' : 'processing')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Package className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold text-white">{processingOrders}</p>
                <p className="text-sm text-slate-400">Processing</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`bg-slate-900 border-slate-800 cursor-pointer transition-all hover:border-purple-500/50 ${statusFilter === 'shipped' ? 'border-purple-500' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'shipped' ? 'all' : 'shipped')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Truck className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold text-white">{shippedOrders}</p>
                <p className="text-sm text-slate-400">Shipped</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`bg-slate-900 border-slate-800 cursor-pointer transition-all hover:border-emerald-500/50 ${statusFilter === 'delivered' ? 'border-emerald-500' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'delivered' ? 'all' : 'delivered')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <CheckCircle className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold text-white">{deliveredOrders}</p>
                <p className="text-sm text-slate-400">Delivered</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Order Status" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="shipped">Shipped</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Payment Status" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">All Payment Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Orders ({pagination.total})</CardTitle>
          <CardDescription className="text-slate-400">Manage orders and track shipments</CardDescription>
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
                    <TableHead className="text-slate-400">Order</TableHead>
                    <TableHead className="text-slate-400">Customer</TableHead>
                    <TableHead className="text-slate-400">Shop</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400">Payment</TableHead>
                    <TableHead className="text-slate-400">Total</TableHead>
                    <TableHead className="text-slate-400">Date</TableHead>
                    <TableHead className="text-slate-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id} className="border-slate-800 hover:bg-slate-800/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {getStatusIcon(order.status)}
                          <div>
                            <div className="font-medium text-white">{order.order_number}</div>
                            <div className="text-sm text-slate-500">{order.items.length} items</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="text-white">{order.customer_name || 'Guest'}</div>
                          <div className="text-sm text-slate-500">{order.customer_email}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-300">{order.shop_name}</TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>{getPaymentBadge(order.payment_status)}</TableCell>
                      <TableCell className="text-white font-medium">{formatCurrency(order.total_amount)}</TableCell>
                      <TableCell className="text-slate-400">
                        {new Date(order.created_at).toLocaleDateString()}
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
                              onClick={() => { setSelectedOrder(order); setShowDetailsModal(true) }}
                              className="text-slate-300 focus:bg-slate-700 focus:text-white"
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => { setSelectedOrder(order); setNewStatus(order.status); setShowUpdateModal(true) }}
                              className="text-slate-300 focus:bg-slate-700 focus:text-white"
                            >
                              <Package className="mr-2 h-4 w-4" />
                              Update Status
                            </DropdownMenuItem>
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
            <DialogTitle>Order Details - {selectedOrder?.order_number}</DialogTitle>
            <DialogDescription className="text-slate-400">View order information and items</DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-400">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedOrder.status)}</div>
                </div>
                <div>
                  <Label className="text-slate-400">Payment</Label>
                  <div className="mt-1">{getPaymentBadge(selectedOrder.payment_status)}</div>
                </div>
                <div>
                  <Label className="text-slate-400">Customer</Label>
                  <p className="text-white">{selectedOrder.customer_name || 'Guest'}</p>
                  <p className="text-sm text-slate-400">{selectedOrder.customer_email}</p>
                </div>
                <div>
                  <Label className="text-slate-400">Shop</Label>
                  <p className="text-white">{selectedOrder.shop_name}</p>
                </div>
                <div>
                  <Label className="text-slate-400">Order Date</Label>
                  <p className="text-white">{new Date(selectedOrder.created_at).toLocaleString()}</p>
                </div>
                {selectedOrder.shipped_at && (
                  <div>
                    <Label className="text-slate-400">Shipped</Label>
                    <p className="text-white">{new Date(selectedOrder.shipped_at).toLocaleString()}</p>
                  </div>
                )}
              </div>

              {selectedOrder.shipping_address && (
                <div>
                  <Label className="text-slate-400 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Shipping Address
                  </Label>
                  <p className="text-white mt-1">
                    {typeof selectedOrder.shipping_address === 'string' 
                      ? selectedOrder.shipping_address 
                      : JSON.stringify(selectedOrder.shipping_address)}
                  </p>
                </div>
              )}

              <div>
                <Label className="text-slate-400">Order Items</Label>
                <div className="mt-2 space-y-2">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800">
                      <div>
                        <p className="text-white">{item.part_name}</p>
                        <p className="text-sm text-slate-400">Qty: {item.quantity} × {formatCurrency(item.unit_price)}</p>
                      </div>
                      <p className="font-semibold text-white">{formatCurrency(item.total_price)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <div className="space-y-2">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal</span>
                    <span>{formatCurrency(selectedOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Tax</span>
                    <span>{formatCurrency(selectedOrder.tax_amount)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Shipping</span>
                    <span>{formatCurrency(selectedOrder.shipping_amount)}</span>
                  </div>
                  {selectedOrder.discount_amount > 0 && (
                    <div className="flex justify-between text-emerald-400">
                      <span>Discount</span>
                      <span>-{formatCurrency(selectedOrder.discount_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xl font-bold text-white pt-2 border-t border-slate-700">
                    <span>Total</span>
                    <span>{formatCurrency(selectedOrder.total_amount)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Update Status Modal */}
      <Dialog open={showUpdateModal} onOpenChange={setShowUpdateModal}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>Update Order Status</DialogTitle>
            <DialogDescription className="text-slate-400">
              Change the status of order {selectedOrder?.order_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-400">Current Status</Label>
              <div className="mt-1">{selectedOrder && getStatusBadge(selectedOrder.status)}</div>
            </div>
            
            <div>
              <Label className="text-slate-400">New Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowUpdateModal(false)} className="border-slate-700 text-slate-300">
                Cancel
              </Button>
              <Button
                onClick={handleUpdateStatus}
                disabled={isProcessing || !newStatus || newStatus === selectedOrder?.status}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isProcessing ? 'Updating...' : 'Update Status'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

