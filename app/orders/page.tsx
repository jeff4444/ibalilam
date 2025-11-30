"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  Package,
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  ChevronRight,
  Calendar,
  MapPin,
  CreditCard,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/hooks/use-auth"
import { MainNavbar } from "@/components/navbar"

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
    category: string
  } | null
}

interface Order {
  id: string
  order_number: string
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
  created_at: string
  updated_at: string
  shipped_at: string | null
  delivered_at: string | null
  order_items: OrderItem[]
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  // Load orders
  useEffect(() => {
    const loadOrders = async () => {
      if (!user?.id) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const response = await fetch("/api/orders")
        
        if (!response.ok) {
          throw new Error("Failed to fetch orders")
        }

        const data = await response.json()
        setOrders(data.orders || [])
      } catch (err) {
        console.error("Error loading orders:", err)
        setError("Failed to load orders. Please try again.")
      } finally {
        setLoading(false)
      }
    }

    if (user || !authLoading) {
      loadOrders()
    }
  }, [user, authLoading])

  const getStatusIcon = (status: Order["status"]) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4" />
      case "confirmed":
      case "processing":
        return <Package className="h-4 w-4" />
      case "shipped":
        return <Truck className="h-4 w-4" />
      case "delivered":
        return <CheckCircle className="h-4 w-4" />
      case "cancelled":
      case "refunded":
        return <XCircle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

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

  // Show loading state
  if (authLoading || loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <MainNavbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading orders...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <MainNavbar />

      <div className="flex-1 space-y-6 p-4 md:p-8 max-w-7xl mx-auto w-full">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">My Orders</h1>
            <p className="text-muted-foreground">
              {orders.length} {orders.length === 1 ? "order" : "orders"} total
            </p>
          </div>
        </div>

        {orders.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No orders yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Start shopping to see your orders here.
              </p>
              <Button asChild>
                <Link href="/parts">Browse Parts</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-wrap gap-4">
            {orders.map((order) => (
              <Card key={order.id} className="hover:shadow-lg transition-shadow flex-1 min-w-[calc(50%-0.5rem)]">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-lg">Order {order.order_number}</CardTitle>
                        <Badge className={getStatusColor(order.status)}>
                          {getStatusIcon(order.status)}
                          <span className="ml-1 capitalize">{order.status}</span>
                        </Badge>
                        <Badge variant="outline" className={getPaymentStatusColor(order.payment_status)}>
                          <span className="capitalize">{order.payment_status}</span>
                        </Badge>
                      </div>
                      <CardDescription className="flex items-center gap-4 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(order.created_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <CreditCard className="h-3 w-3" />
                          {order.payment_method || "N/A"}
                        </span>
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">R{order.total_amount.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">
                        {order.order_items.length} {order.order_items.length === 1 ? "item" : "items"}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Order Items Preview */}
                    <div className="space-y-2">
                      {order.order_items.slice(0, 3).map((item) => (
                        <div key={item.id} className="flex items-center gap-3">
                          <div className="relative w-16 h-16 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                            <Image
                              src={item.parts?.image_url || "/placeholder.svg"}
                              alt={item.parts?.name || "Part"}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{item.parts?.name || "Unknown Part"}</p>
                            <p className="text-sm text-muted-foreground">
                              Qty: {item.quantity} × R{item.unit_price.toFixed(2)}
                            </p>
                          </div>
                          <p className="font-medium">R{item.total_price.toFixed(2)}</p>
                        </div>
                      ))}
                      {order.order_items.length > 3 && (
                        <p className="text-sm text-muted-foreground text-center pt-2">
                          +{order.order_items.length - 3} more {order.order_items.length - 3 === 1 ? "item" : "items"}
                        </p>
                      )}
                    </div>

                    <Separator />

                    {/* Order Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Subtotal</p>
                        <p className="font-medium">R{order.subtotal.toFixed(2)}</p>
                      </div>
                      {order.shipping_amount > 0 && (
                        <div>
                          <p className="text-muted-foreground">Shipping</p>
                          <p className="font-medium">R{order.shipping_amount.toFixed(2)}</p>
                        </div>
                      )}
                      {order.tax_amount > 0 && (
                        <div>
                          <p className="text-muted-foreground">Tax</p>
                          <p className="font-medium">R{order.tax_amount.toFixed(2)}</p>
                        </div>
                      )}
                      {order.discount_amount > 0 && (
                        <div>
                          <p className="text-muted-foreground">Discount</p>
                          <p className="font-medium text-green-600">-R{order.discount_amount.toFixed(2)}</p>
                        </div>
                      )}
                    </div>

                    {/* Shipping Address */}
                    {order.shipping_address && (
                      <div className="flex items-start gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-muted-foreground">Shipping to:</p>
                          <p className="font-medium">{formatAddress(order.shipping_address)}</p>
                        </div>
                      </div>
                    )}

                    {/* Timestamps */}
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      {order.shipped_at && (
                        <span>Shipped: {formatDate(order.shipped_at)}</span>
                      )}
                      {order.delivered_at && (
                        <span>Delivered: {formatDate(order.delivered_at)}</span>
                      )}
                    </div>

                    {/* View Details Button */}
                    <Button
                      variant="outline"
                      className="w-full"
                      asChild
                    >
                      <Link href={`/orders/${order.id}`}>
                        View Order Details
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
