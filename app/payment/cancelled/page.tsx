"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { XCircle, ArrowLeft, HelpCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchWithCsrf } from "@/lib/csrf-client"

export default function PaymentCancelledPage() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get("orderId")
  const [deletionStatus, setDeletionStatus] = useState<"idle" | "deleting" | "deleted" | "error">("idle")

  useEffect(() => {
    const deleteOrder = async () => {
      if (!orderId || deletionStatus !== "idle") return

      setDeletionStatus("deleting")
      try {
        const response = await fetchWithCsrf(`/api/orders/${orderId}`, {
          method: "DELETE",
        })

        if (response.ok) {
          setDeletionStatus("deleted")
        } else {
          // Even if deletion fails (e.g., order already deleted or user not authorized), 
          // we don't show an error to the user as the payment was already cancelled
          setDeletionStatus("deleted")
        }
      } catch (error) {
        console.error("Error deleting order:", error)
        setDeletionStatus("deleted") // Still show as deleted to user
      }
    }

    deleteOrder()
  }, [orderId, deletionStatus])

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-orange-50 to-background">
      <div className="flex-1 container mx-auto px-4 py-12 flex items-center justify-center">
        <Card className="max-w-2xl w-full">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
              {deletionStatus === "deleting" ? (
                <Loader2 className="h-10 w-10 text-orange-600 animate-spin" />
              ) : (
                <XCircle className="h-10 w-10 text-orange-600" />
              )}
            </div>
            <CardTitle className="text-3xl">Payment Cancelled</CardTitle>
            <CardDescription className="text-lg">
              {deletionStatus === "deleting" 
                ? "Cancelling your order..." 
                : "Your payment was not completed. No charges have been made to your account."}
              {deletionStatus === "deleted" && orderId && (
                <span className="block mt-2 text-sm text-muted-foreground">
                  Your order has been cancelled and removed.
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 p-6 rounded-lg space-y-3">
              <div className="flex items-start space-x-3">
                <HelpCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">What happened?</h3>
                  <p className="text-sm text-muted-foreground">
                    You cancelled the payment process or closed the payment window. Your items are still in your cart and ready when you're ready to complete your purchase.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Button asChild className="w-full" size="lg">
                <Link href="/cart">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Return to Cart
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full" size="lg">
                <Link href="/parts">
                  Continue Shopping
                </Link>
              </Button>
            </div>

            <div className="border-t pt-6">
              <h4 className="font-semibold mb-3 text-sm">Common reasons for payment cancellation:</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Payment window was closed before completing the transaction</li>
                <li>• Changed your mind about the purchase</li>
                <li>• Encountered an issue with payment details</li>
                <li>• Need to review order details before proceeding</li>
              </ul>
            </div>

            <div className="text-center text-sm text-muted-foreground pt-4">
              <p>Having trouble? <Link href="/contact" className="text-primary hover:underline">Contact Support</Link></p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

