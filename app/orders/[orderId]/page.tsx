"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import {
  Package,
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  ArrowLeft,
  Calendar,
  MapPin,
  CreditCard,
  ExternalLink,
  MessageCircle,
  ClipboardCheck,
  PackageCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useAuth } from "@/hooks/use-auth"
import { MainNavbar } from "@/components/navbar"
import { useCartStore } from "@/lib/cart-store"

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
    shop_id: string
  } | null
}

interface Shop {
  id: string
  name: string
  user_id: string
}

interface Order {
  id: string
  order_number: string
  shop_id: string
  customer_id: string
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
  billing_address: {
    firstName?: string
    lastName?: string
    address?: string
    city?: string
    state?: string
    zipCode?: string
    country?: string
  } | null
  payment_method: string | null
  customer_notes: string | null
  tracking_number: string | null
  carrier: string | null
  tracking_url: string | null
  created_at: string
  updated_at: string
  shipped_at: string | null
  delivered_at: string | null
  order_items: OrderItem[]
  shops: Shop | null
}

const ORDER_STATUSES = [
  { key: "pending", label: "Pending", icon: Clock },
  { key: "confirmed", label: "Confirmed", icon: ClipboardCheck },
  { key: "processing", label: "Processing", icon: Package },
  { key: "shipped", label: "Shipped", icon: Truck },
  { key: "delivered", label: "Delivered", icon: PackageCheck },
]

export default function OrderDetailPage() {
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const orderId = params.orderId as string
  const paymentSuccess = searchParams.get("payment_success") === "true"
  const clearCart = useCartStore((state) => state.clearCart)

  const canCancel = order?.status === "pending" && order?.payment_status === "pending"

  const handleCancelOrder = async () => {
    if (!orderId || !canCancel) return

    try {
      setCancelling(true)
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to cancel order")
      }

      // Update the order state to reflect cancellation
      setOrder(prev => prev ? { ...prev, status: "cancelled" } : null)
    } catch (err) {
      console.error("Error cancelling order:", err)
      setError(err instanceof Error ? err.message : "Failed to cancel order")
    } finally {
      setCancelling(false)
    }
  }

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  // Clear cart when payment is successful
  useEffect(() => {
    if (paymentSuccess) {
      clearCart()
    }
  }, [paymentSuccess, clearCart])

  // Load order
  useEffect(() => {
    const loadOrder = async () => {
      if (!user?.id || !orderId) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const response = await fetch(`/api/orders/${orderId}`)
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Order not found")
          }
          throw new Error("Failed to fetch order")
        }

        const data = await response.json()
        setOrder(data.order)
      } catch (err) {
        console.error("Error loading order:", err)
        setError(err instanceof Error ? err.message : "Failed to load order. Please try again.")
      } finally {
        setLoading(false)
      }
    }

    if (user || !authLoading) {
      loadOrder()
    }
  }, [user, authLoading, orderId])

  const getStatusColor = (status: Order["status"]) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "confirmed":
      case "processing":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "shipped":
        return "bg-purple-100 text-purple-800 border-purple-200"
      case "delivered":
        return "bg-green-100 text-green-800 border-green-200"
      case "cancelled":
      case "refunded":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getPaymentStatusColor = (status: Order["payment_status"]) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800 border-green-200"
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "failed":
      case "refunded":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getStatusIcon = (status: Order["status"]) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4" />
      case "confirmed":
        return <ClipboardCheck className="h-4 w-4" />
      case "processing":
        return <Package className="h-4 w-4" />
      case "shipped":
        return <Truck className="h-4 w-4" />
      case "delivered":
        return <PackageCheck className="h-4 w-4" />
      case "cancelled":
      case "refunded":
        return <XCircle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatAddress = (address: Order["shipping_address"]) => {
    if (!address) return "N/A"
    const parts = [
      address.address,
      address.city,
      address.state,
      address.zipCode,
      address.country,
    ].filter(Boolean)
    return parts.join(", ")
  }

  const getCurrentStatusIndex = (status: Order["status"]) => {
    if (status === "cancelled" || status === "refunded") return -1
    return ORDER_STATUSES.findIndex((s) => s.key === status)
  }

  // Show loading state
  if (authLoading || loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <MainNavbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading order details...</p>
          </div>
        </div>
      </div>
    )
  }

  // Show error state
  if (error || !order) {
    return (
      <div className="flex flex-col min-h-screen">
        <MainNavbar />
        <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
          <Button variant="ghost" className="mb-4" onClick={() => router.push("/orders")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Orders
          </Button>
          <Alert variant="destructive">
            <AlertDescription>{error || "Order not found"}</AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  const currentStatusIndex = getCurrentStatusIndex(order.status)
  const isCancelledOrRefunded = order.status === "cancelled" || order.status === "refunded"

  return (
    <div className="flex flex-col min-h-screen">
      <MainNavbar />

      <div className="flex-1 space-y-6 p-4 md:p-8 max-w-7xl mx-auto w-full">
        {/* Payment Success Message */}
        {paymentSuccess && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 font-medium">
              Thank you for shopping with Techafon! Your payment has been received and your order is being processed.
            </AlertDescription>
          </Alert>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push("/orders")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Order {order.order_number}</h1>
              <p className="text-muted-foreground flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Placed on {formatDate(order.created_at)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={getStatusColor(order.status)}>
              {getStatusIcon(order.status)}
              <span className="ml-1 capitalize">{order.status}</span>
            </Badge>
            <Badge variant="outline" className={getPaymentStatusColor(order.payment_status)}>
              <CreditCard className="h-3 w-3 mr-1" />
              <span className="capitalize">{order.payment_status}</span>
            </Badge>
          </div>
        </div>

        {/* Cancel Order Option */}
        {canCancel && (
          <Card className="border-yellow-200 bg-yellow-50/50">
            <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-6">
              <div>
                <p className="font-medium text-yellow-800">Payment Pending</p>
                <p className="text-sm text-yellow-700">
                  This order is awaiting payment. You can cancel it if you no longer wish to proceed.
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={cancelling}>
                    <XCircle className="h-4 w-4 mr-2" />
                    {cancelling ? "Cancelling..." : "Cancel Order"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Order?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to cancel this order? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Order</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCancelOrder}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Yes, Cancel Order
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        )}

        {/* Status Timeline */}
        {!isCancelledOrRefunded && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Order Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {/* Progress bar background */}
                <div className="absolute top-5 left-0 right-0 h-1 bg-gray-200 rounded-full mx-8" />
                
                {/* Progress bar fill */}
                <div 
                  className="absolute top-5 left-0 h-1 bg-blue-600 rounded-full mx-8 transition-all duration-500"
                  style={{ 
                    width: currentStatusIndex >= 0 
                      ? `calc(${(currentStatusIndex / (ORDER_STATUSES.length - 1)) * 100}% - 4rem)` 
                      : '0%' 
                  }}
                />

                {/* Status steps */}
                <div className="relative flex justify-between">
                  {ORDER_STATUSES.map((status, index) => {
                    const isCompleted = index <= currentStatusIndex
                    const isCurrent = index === currentStatusIndex
                    const StatusIcon = status.icon

                    return (
                      <div key={status.key} className="flex flex-col items-center">
                        <div
                          className={`
                            w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all
                            ${isCompleted 
                              ? 'bg-blue-600 border-blue-600 text-white' 
                              : 'bg-white border-gray-300 text-gray-400'
                            }
                            ${isCurrent ? 'ring-4 ring-blue-100' : ''}
                          `}
                        >
                          {isCompleted && index < currentStatusIndex ? (
                            <CheckCircle className="h-5 w-5" />
                          ) : (
                            <StatusIcon className="h-5 w-5" />
                          )}
                        </div>
                        <span className={`
                          mt-2 text-xs sm:text-sm font-medium text-center
                          ${isCompleted ? 'text-blue-600' : 'text-gray-400'}
                        `}>
                          {status.label}
                        </span>
                        {/* Show timestamp for shipped and delivered */}
                        {status.key === "shipped" && order.shipped_at && (
                          <span className="text-xs text-muted-foreground mt-1 hidden sm:block">
                            {new Date(order.shipped_at).toLocaleDateString()}
                          </span>
                        )}
                        {status.key === "delivered" && order.delivered_at && (
                          <span className="text-xs text-muted-foreground mt-1 hidden sm:block">
                            {new Date(order.delivered_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cancelled/Refunded Notice */}
        {isCancelledOrRefunded && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              This order has been {order.status}. 
              {order.status === "refunded" && " A refund has been processed."}
            </AlertDescription>
          </Alert>
        )}

        {/* Tracking Information */}
        {order.tracking_number && (
          <Card className="border-purple-200 bg-purple-50/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Truck className="h-5 w-5 text-purple-600" />
                Tracking Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Tracking Number</p>
                  <p className="font-mono font-semibold text-lg">{order.tracking_number}</p>
                  {order.carrier && (
                    <p className="text-sm text-muted-foreground">
                      Carrier: <span className="font-medium text-foreground">{order.carrier}</span>
                    </p>
                  )}
                </div>
                {order.tracking_url && (
                  <Button asChild className="bg-purple-600 hover:bg-purple-700">
                    <a href={order.tracking_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Track Package
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Order Items */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Order Items</CardTitle>
                <CardDescription>
                  {order.order_items.length} {order.order_items.length === 1 ? "item" : "items"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {order.order_items.map((item) => (
                    <div key={item.id} className="flex gap-4 p-4 border rounded-lg">
                      <div className="relative w-20 h-20 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                        <Image
                          src={item.parts?.image_url || item.parts?.images?.[0] || "/placeholder.svg"}
                          alt={item.parts?.name || "Part"}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link 
                          href={`/parts/${item.part_id}`}
                          className="font-medium hover:text-blue-600 hover:underline"
                        >
                          {item.parts?.name || "Unknown Part"}
                        </Link>
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.parts?.category || "N/A"}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-sm">
                            Qty: {item.quantity} × R{item.unit_price.toFixed(2)}
                          </p>
                          <p className="font-semibold">R{item.total_price.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Customer Notes */}
            {order.customer_notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Your Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{order.customer_notes}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Order Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>R{order.subtotal.toFixed(2)}</span>
                </div>
                {order.shipping_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span>R{order.shipping_amount.toFixed(2)}</span>
                  </div>
                )}
                {order.tax_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span>R{order.tax_amount.toFixed(2)}</span>
                  </div>
                )}
                {order.discount_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="text-green-600">-R{order.discount_amount.toFixed(2)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>R{order.total_amount.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Payment Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Payment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Method</span>
                  <span className="font-medium">{order.payment_method || "N/A"}</span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="outline" className={getPaymentStatusColor(order.payment_status)}>
                    <span className="capitalize">{order.payment_status}</span>
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Shipping Address */}
            {order.shipping_address && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Shipping Address
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-medium">
                    {order.shipping_address.firstName} {order.shipping_address.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatAddress(order.shipping_address)}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Billing Address */}
            {order.billing_address && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Billing Address
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-medium">
                    {order.billing_address.firstName} {order.billing_address.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatAddress(order.billing_address)}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Order Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Order Placed</span>
                  <span>{formatDate(order.created_at)}</span>
                </div>
                {order.updated_at && order.updated_at !== order.created_at && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Last Updated</span>
                    <span>{formatDate(order.updated_at)}</span>
                  </div>
                )}
                {order.shipped_at && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipped</span>
                    <span>{formatDate(order.shipped_at)}</span>
                  </div>
                )}
                {order.delivered_at && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Delivered</span>
                    <span>{formatDate(order.delivered_at)}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contact Seller */}
            {order.shops && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Need Help?</CardTitle>
                  <CardDescription>Contact the seller about this order</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Sold by: <span className="font-medium text-foreground">{order.shops.name}</span>
                    </p>
                    <Button variant="outline" className="w-full" asChild>
                      <Link href={`/contact/${order.shops.user_id}`}>
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Contact Seller
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

