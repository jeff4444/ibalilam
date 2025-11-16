"use client"

import { useEffect } from "react"
import Link from "next/link"
import { CheckCircle, Package, ArrowRight, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useCartStore } from "@/lib/cart-store"

export default function PaymentSuccessPage() {
  const { clearCart } = useCartStore()

  useEffect(() => {
    // Clear the cart after successful payment
    clearCart()
  }, [clearCart])

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-green-50 to-background">
      <div className="flex-1 container mx-auto px-4 py-12 flex items-center justify-center">
        <Card className="max-w-2xl w-full">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <CardTitle className="text-3xl">Payment Successful!</CardTitle>
            <CardDescription className="text-lg">
              Thank you for your order. Your payment has been processed successfully.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 p-6 rounded-lg space-y-3">
              <div className="flex items-start space-x-3">
                <Package className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">What happens next?</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• You will receive an email confirmation shortly</li>
                    <li>• The seller will be notified of your order</li>
                    <li>• You can track your order status in your dashboard</li>
                    <li>• Your items will be prepared for shipping</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Button asChild className="w-full" size="lg">
                <Link href="/dashboard">
                  View Order Status
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full" size="lg">
                <Link href="/parts">
                  <Home className="mr-2 h-4 w-4" />
                  Continue Shopping
                </Link>
              </Button>
            </div>

            <div className="text-center text-sm text-muted-foreground pt-4">
              <p>Need help? <Link href="/contact" className="text-primary hover:underline">Contact Support</Link></p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

