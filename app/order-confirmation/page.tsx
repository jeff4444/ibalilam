"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Cpu, CheckCircle, Package, Truck, Download, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { useCartStore } from "@/lib/cart-store"

export default function OrderConfirmationPage() {
  const { items, clearCart, getTotalPrice } = useCartStore()

  // Generate order details
  const orderNumber = `ORD-${Date.now().toString().slice(-6)}`
  const orderDate = new Date().toLocaleDateString()
  const estimatedDelivery = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()
  const totalPrice = getTotalPrice()
  const tax = totalPrice * 0.08
  const shipping = totalPrice > 50 ? 0 : 9.99
  const finalTotal = totalPrice + tax + shipping

  // Clear cart on successful order
  useEffect(() => {
    const timer = setTimeout(() => {
      clearCart()
    }, 2000)
    return () => clearTimeout(timer)
  }, [clearCart])

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="px-4 lg:px-6 h-14 flex items-center border-b">
        <Link className="flex items-center justify-center" href="/">
          <Cpu className="h-6 w-6 mr-2 text-blue-600" />
          <span className="font-bold text-xl">Techafon</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/parts">
            Browse Parts
          </Link>
          <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/dashboard">
            Dashboard
          </Link>
          <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/profile">
            Profile
          </Link>
        </nav>
      </header>

      <div className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Success Message */}
          <div className="text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />
            <h1 className="text-3xl font-bold text-green-600">Order Confirmed!</h1>
            <p className="text-muted-foreground">
              Thank you for your purchase. Your order has been successfully placed and is being processed.
            </p>
          </div>

          {/* Order Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Order Details</span>
                <Badge variant="secondary">Processing</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Order Number</p>
                  <p className="font-medium">{orderNumber}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Order Date</p>
                  <p className="font-medium">{orderDate}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Estimated Delivery</p>
                  <p className="font-medium">{estimatedDelivery}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Amount</p>
                  <p className="font-medium">${finalTotal.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle>Items Ordered</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between items-center py-2 border-b last:border-b-0">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Qty: {item.quantity} × ${item.price} • by {item.seller}
                    </p>
                  </div>
                  <span className="font-medium">${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>${totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span>{shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-medium text-lg">
                  <span>Total</span>
                  <span>${finalTotal.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Package className="mr-2 h-5 w-5" />
                Order Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                  <div>
                    <p className="font-medium">Order Confirmed</p>
                    <p className="text-sm text-muted-foreground">Your order has been received and confirmed</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div>
                    <p className="font-medium">Processing</p>
                    <p className="text-sm text-muted-foreground">We're preparing your items for shipment</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                  <div>
                    <p className="text-muted-foreground">Shipped</p>
                    <p className="text-sm text-muted-foreground">Your order is on its way</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                  <div>
                    <p className="text-muted-foreground">Delivered</p>
                    <p className="text-sm text-muted-foreground">Your order has been delivered</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Next Steps */}
          <Card>
            <CardHeader>
              <CardTitle>What's Next?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Button variant="outline" className="h-auto p-4 flex flex-col items-start space-y-2">
                  <div className="flex items-center space-x-2">
                    <Truck className="h-4 w-4" />
                    <span className="font-medium">Track Your Order</span>
                  </div>
                  <p className="text-sm text-muted-foreground text-left">Get real-time updates on your shipment</p>
                </Button>

                <Button variant="outline" className="h-auto p-4 flex flex-col items-start space-y-2">
                  <div className="flex items-center space-x-2">
                    <Download className="h-4 w-4" />
                    <span className="font-medium">Download Receipt</span>
                  </div>
                  <p className="text-sm text-muted-foreground text-left">Save your order confirmation</p>
                </Button>
              </div>

              <div className="text-center pt-4">
                <p className="text-sm text-muted-foreground mb-4">
                  We'll send you email updates about your order status.
                </p>
                <Button asChild>
                  <Link href="/parts">
                    Continue Shopping
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
