"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Cpu, Plus, Minus, Trash2, ShoppingCart, ArrowLeft, AlertTriangle, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useCartStore } from "@/lib/cart-store"
import { CartButton } from "@/components/cart-button"
import { QuantitySelector } from "@/components/quantity-selector"

export default function CartPage() {
  const { items, updateQuantity, removeItem, getTotalPrice, getTotalItems, validateCart, getInvalidItems } = useCartStore()
  const [isLoading, setIsLoading] = useState(false)

  const totalPrice = getTotalPrice()
  const totalItems = getTotalItems()
  const shipping = totalPrice > 50 ? 0 : 9.99
  const tax = totalPrice * 0.08
  const finalTotal = totalPrice + shipping + tax

  const handleQuantityChange = (id: string, newQuantity: number, priceInfo?: any) => {
    updateQuantity(id, newQuantity, priceInfo)
  }

  const handleRemoveItem = (id: string) => {
    removeItem(id)
  }

  const handleCheckout = () => {
    const validation = validateCart()
    if (!validation.isValid) {
      alert(`Cannot proceed to checkout. Please fix the following issues:\n${validation.errors.join('\n')}`)
      return
    }
    
    setIsLoading(true)
    // Simulate loading
    setTimeout(() => {
      window.location.href = "/checkout"
    }, 1000)
  }

  const cartValidation = validateCart()
  const invalidItems = getInvalidItems()

  if (items.length === 0) {
    return (
      <div className="flex flex-col min-h-screen">
        {/* Header */}
        <header className="px-4 lg:px-6 h-14 flex items-center border-b">
          <Link className="flex items-center justify-center" href="/">
            <Cpu className="h-6 w-6 mr-2 text-blue-600" />
            <span className="font-bold text-xl">Techafon</span>
          </Link>
          <nav className="ml-auto flex gap-4 sm:gap-6 items-center">
            <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/parts">
              Browse Parts
            </Link>
            <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/favorites">
              Favorites
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

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground" />
            <h2 className="text-2xl font-bold">Your cart is empty</h2>
            <p className="text-muted-foreground">Add some electronic parts to get started!</p>
            <Button asChild>
              <Link href="/parts">Browse Parts</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="px-4 lg:px-6 h-14 flex items-center border-b">
        <Link className="flex items-center justify-center" href="/">
          <Cpu className="h-6 w-6 mr-2 text-blue-600" />
          <span className="font-bold text-xl">Techafon</span>
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

      <div className="flex-1 container mx-auto px-4 py-6">
        <div className="flex items-center space-x-2 mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/parts">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Continue Shopping
            </Link>
          </Button>
        </div>

        {/* Cart Validation Alert */}
        {!cartValidation.isValid && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <p className="font-medium">Cannot proceed to checkout</p>
                <ul className="list-disc list-inside text-sm">
                  {cartValidation.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ShoppingCart className="mr-2 h-5 w-5" />
                  Shopping Cart ({totalItems} {totalItems === 1 ? "item" : "items"})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-4 py-4 border-b last:border-b-0">
                    <Image
                      src={item.image || "/placeholder.svg"}
                      alt={item.name}
                      width={80}
                      height={80}
                      className="rounded-md object-cover"
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium">{item.name}</h3>
                          <p className="text-sm text-muted-foreground">by {item.seller}</p>
                          <Badge variant="outline" className="mt-1">
                            {item.condition}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          {/* Use QuantitySelector for items with MOQ rules */}
                          {(item.moqUnits || item.packSizeUnits || item.orderIncrement) ? (
                            <QuantitySelector
                              partId={item.id}
                              initialQuantity={item.quantity}
                              moqUnits={item.moqUnits || 1}
                              orderIncrement={item.orderIncrement || 1}
                              packSizeUnits={item.packSizeUnits}
                              onQuantityChange={handleQuantityChange}
                              className="max-w-xs"
                            />
                          ) : (
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                                disabled={item.quantity <= 1}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center">{item.quantity}</span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                                disabled={item.quantity >= item.stock}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                              <span className="text-xs text-muted-foreground ml-2">{item.stock} available</span>
                            </div>
                          )}
                          
                          {/* Show validation status */}
                          {item.isValidQuantity === false && (
                            <Alert variant="destructive" className="mt-2">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription className="text-sm">
                                {item.validationError}
                              </AlertDescription>
                            </Alert>
                          )}
                          
                          {item.isValidQuantity === true && (
                            <div className="flex items-center gap-1 mt-2 text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-sm">Valid quantity</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="text-right min-w-[120px]">
                          <p className="font-medium">
                            ${((item.tierPrice || item.price) * item.quantity).toFixed(2)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            ${(item.tierPrice || item.price).toFixed(2)} each
                          </p>
                          {item.tierName && item.tierName !== 'Base Price' && (
                            <p className="text-xs text-blue-600">{item.tierName}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal ({totalItems} items)</span>
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

                {shipping > 0 && (
                  <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-md">
                    Add ${(50 - totalPrice).toFixed(2)} more for free shipping!
                  </div>
                )}

                <Button 
                  className="w-full" 
                  size="lg" 
                  onClick={handleCheckout} 
                  disabled={isLoading || !cartValidation.isValid}
                >
                  {isLoading ? "Processing..." : 
                   !cartValidation.isValid ? "Fix quantity issues to continue" : 
                   "Proceed to Checkout"}
                </Button>

                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• Secure checkout with SSL encryption</p>
                  <p>• 30-day return policy</p>
                  <p>• Quality guarantee on all items</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Accepted Payment Methods</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex space-x-2">
                  <div className="w-8 h-5 bg-blue-600 rounded text-white text-xs flex items-center justify-center">
                    VISA
                  </div>
                  <div className="w-8 h-5 bg-red-600 rounded text-white text-xs flex items-center justify-center">
                    MC
                  </div>
                  <div className="w-8 h-5 bg-blue-500 rounded text-white text-xs flex items-center justify-center">
                    AMEX
                  </div>
                  <div className="w-8 h-5 bg-yellow-500 rounded text-white text-xs flex items-center justify-center">
                    PP
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
