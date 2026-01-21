"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Cpu, CreditCard, Truck, Shield, ArrowLeft, Check, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCartStore } from "@/lib/cart-store"
import { MainNavbar } from "@/components/navbar"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { getCsrfHeaders } from "@/lib/csrf-client"

interface ShippingAddress {
  id: string
  label: string | null
  first_name: string
  last_name: string
  address: string
  city: string
  state: string
  zip_code: string
  country: string
  is_default: boolean
  created_at: string
  updated_at: string
}

export default function CheckoutPage() {
  const { toast } = useToast()
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(false)
  const [isCartLoading, setIsCartLoading] = useState(true)
  const { items, getTotalPrice, getTotalItems, syncCart, isSyncing } = useCartStore()
  const [shippingMethod, setShippingMethod] = useState("standard")
  const payfastFormRef = useRef<HTMLFormElement>(null)
  const [payfastData, setPayfastData] = useState<Record<string, string> | null>(null)
  const [payfastUrl, setPayfastUrl] = useState<string>("")
  const [savedAddresses, setSavedAddresses] = useState<ShippingAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false)
  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "ZA",
    saveInfo: false,
  })

  const totalPrice = getTotalPrice()
  const totalItems = getTotalItems()
  const shippingCost = shippingMethod === "express" ? 19.99 : totalPrice > 50 ? 0 : 9.99
  const finalTotal = totalPrice + shippingCost

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear selected address when user manually edits form
    if (selectedAddressId && field !== "saveInfo") {
      setSelectedAddressId(null)
    }
  }

  // Load saved addresses for authenticated users
  const loadSavedAddresses = useCallback(async () => {
    if (!user) return

    setIsLoadingAddresses(true)
    try {
      const response = await fetch("/api/shipping-addresses")
      if (response.ok) {
        const data = await response.json()
        setSavedAddresses(data.addresses || [])
        
        // Prefill with default address if available
        const defaultAddress = data.addresses?.find((addr: ShippingAddress) => addr.is_default)
        if (defaultAddress) {
          setSelectedAddressId(defaultAddress.id)
          setFormData((prev) => ({
            ...prev,
            firstName: defaultAddress.first_name,
            lastName: defaultAddress.last_name,
            address: defaultAddress.address,
            city: defaultAddress.city,
            state: defaultAddress.state,
            zipCode: defaultAddress.zip_code,
            country: defaultAddress.country || "ZA",
          }))
        }
      }
    } catch (error) {
      console.error("Error loading saved addresses:", error)
    } finally {
      setIsLoadingAddresses(false)
    }
  }, [user])

  // Handle selecting a saved address
  const handleSelectAddress = (addressId: string) => {
    const address = savedAddresses.find((addr) => addr.id === addressId)
    if (address) {
      setSelectedAddressId(addressId)
      setFormData((prev) => ({
        ...prev,
        firstName: address.first_name,
        lastName: address.last_name,
        address: address.address,
        city: address.city,
        state: address.state,
        zipCode: address.zip_code,
        country: address.country || "ZA",
      }))
    }
  }

  // Save shipping address after order creation
  const saveShippingAddress = async () => {
    if (!user || !formData.saveInfo) return

    try {
      const addressData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zipCode: formData.zipCode,
        country: formData.country,
        isDefault: savedAddresses.length === 0, // Set as default if it's the first address
      }

      // Check if we're updating an existing address
      if (selectedAddressId) {
        const response = await fetch("/api/shipping-addresses", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...getCsrfHeaders(),
          },
          body: JSON.stringify({
            id: selectedAddressId,
            ...addressData,
          }),
        })

        if (!response.ok) {
          console.error("Failed to update shipping address")
        }
      } else {
        // Create new address
        const response = await fetch("/api/shipping-addresses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getCsrfHeaders(),
          },
          body: JSON.stringify(addressData),
        })

        if (!response.ok) {
          console.error("Failed to save shipping address")
        }
      }
    } catch (error) {
      console.error("Error saving shipping address:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Check if user is authenticated
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "You must be signed in to proceed with checkout. Please sign in first.",
        variant: "destructive",
      })
      router.push("/login?redirectTo=/checkout")
      return
    }

    setIsProcessing(true)

    try {
      // Generate order summary for item name
      const itemNames = items.map(item => `${item.name} (x${item.quantity})`).join(", ")
      const itemName = itemNames.length > 100 ? `${itemNames.substring(0, 97)}...` : itemNames

      // SECURITY FIX: Only send part_id and quantity - prices are calculated server-side
      // This prevents client-side price manipulation attacks (VULN-001)
      const orderResponse = await fetch("/api/orders/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCsrfHeaders(),
        },
        body: JSON.stringify({
          // Only send part_id and quantity - NO price data
          items: items.map(item => ({
            part_id: item.id,
            quantity: item.quantity,
            // NOTE: tierPrice, price, and all other pricing fields are intentionally NOT sent
            // The server calculates all prices from the database to prevent manipulation
          })),
          shippingAddress: {
            firstName: formData.firstName,
            lastName: formData.lastName,
            address: formData.address,
            city: formData.city,
            state: formData.state,
            zipCode: formData.zipCode,
            country: formData.country,
          },
          customerEmail: formData.email,
          customerName: `${formData.firstName} ${formData.lastName}`.trim(),
          shippingMethod: shippingMethod, // Server calculates shipping cost based on this
          // NOTE: subtotal, shippingAmount, taxAmount, discountAmount, totalAmount are NOT sent
          // All pricing is calculated server-side from database values
        }),
      })

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json()
        throw new Error(errorData.error || "Failed to create order")
      }

      const orderData = await orderResponse.json()
      const orderId = orderData.orderId

      if (!orderId) {
        throw new Error("Order created but no order ID returned")
      }

      // Save shipping address if checkbox is checked
      if (formData.saveInfo && user) {
        await saveShippingAddress()
      }

      // SECURITY FIX: PayFast endpoint now fetches the amount from the order in the database
      // We only send the orderId - the server retrieves the verified total_amount
      const response = await fetch("/api/payfast/generate-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCsrfHeaders(),
        },
        body: JSON.stringify({
          orderId: orderId, // Server fetches amount from DB using this
          itemName: itemName || "Order Payment",
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          // NOTE: amount is NOT sent - server fetches it from the order record
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate payment")
      }

      const data = await response.json()

      // Set PayFast data and URL
      setPayfastData(data.payfastData)
      setPayfastUrl(data.payfastUrl)

      // The form will auto-submit via useEffect once data is set
    } catch (error) {
      console.error("Payment error:", error)
      toast({
        title: "Payment Error",
        description: error instanceof Error ? error.message : "Failed to initiate payment. Please try again.",
        variant: "destructive",
      })
      setIsProcessing(false)
    }
  }

  // Auto-submit PayFast form when data is ready
  useEffect(() => {
    if (payfastData && payfastUrl && payfastFormRef.current) {
      payfastFormRef.current.submit()
    }
  }, [payfastData, payfastUrl])

  // Wait for cart to load from DB or localStorage
  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) {
      return
    }

    const loadCart = async () => {
      // If user is authenticated, sync cart from database
      if (user) {
        try {
          await syncCart()
        } catch (error) {
          console.error('Error syncing cart:', error)
        }
      }
      
      // For guests, Zustand persist hydrates automatically from localStorage
      // For authenticated users, we'll wait for isSyncing to become false
      if (!user) {
        setIsCartLoading(false)
      }
    }

    loadCart()
  }, [user, authLoading, syncCart])

  // Watch for sync completion for authenticated users
  useEffect(() => {
    if (!authLoading && user && !isSyncing) {
      setIsCartLoading(false)
    }
  }, [authLoading, user, isSyncing])

  // Prefill email when user loads
  useEffect(() => {
    if (user?.email && !formData.email) {
      setFormData((prev) => ({ ...prev, email: user.email || "" }))
    }
  }, [user?.email])

  // Load saved addresses when user is authenticated
  useEffect(() => {
    if (user && !authLoading) {
      loadSavedAddresses()
    }
  }, [user, authLoading, loadSavedAddresses])

  // Show loading state while cart is being loaded
  if (isCartLoading || authLoading || isSyncing) {
    return (
      <div className="flex flex-col min-h-screen">
        <MainNavbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold">Loading checkout...</h2>
          </div>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col min-h-screen">
        <MainNavbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold">No items to checkout</h2>
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
      <MainNavbar />

      <div className="flex-1 container mx-auto px-4 py-6">
        <div className="flex items-center space-x-2 mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/cart">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Cart
            </Link>
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Checkout Form */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="mr-2 h-5 w-5" />
                  Checkout
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Contact Information */}
                  <div className="space-y-4">
                    <h3 className="font-medium">Contact Information</h3>
                    <div>
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Shipping Address */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">Shipping Address</h3>
                      {user && savedAddresses.length > 0 && (
                        <Select
                          value={selectedAddressId || "new"}
                          onValueChange={(value) => {
                            if (value === "new") {
                              setSelectedAddressId(null)
                              setFormData((prev) => ({
                                ...prev,
                                firstName: "",
                                lastName: "",
                                address: "",
                                city: "",
                                state: "",
                                zipCode: "",
                                country: "ZA",
                              }))
                            } else {
                              handleSelectAddress(value)
                            }
                          }}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Select address" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">New Address</SelectItem>
                            {savedAddresses.map((address) => (
                              <SelectItem key={address.id} value={address.id}>
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4" />
                                  <span>
                                    {address.label || `${address.first_name} ${address.last_name}`}
                                    {address.is_default && (
                                      <span className="ml-1 text-xs text-muted-foreground">(Default)</span>
                                    )}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                          id="firstName"
                          value={formData.firstName}
                          onChange={(e) => handleInputChange("firstName", e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          value={formData.lastName}
                          onChange={(e) => handleInputChange("lastName", e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="address">Address</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => handleInputChange("address", e.target.value)}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          value={formData.city}
                          onChange={(e) => handleInputChange("city", e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="state">Province</Label>
                        <Select value={formData.state} onValueChange={(value) => handleInputChange("state", value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select province" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="EC">Eastern Cape</SelectItem>
                            <SelectItem value="FS">Free State</SelectItem>
                            <SelectItem value="GP">Gauteng</SelectItem>
                            <SelectItem value="KZN">KwaZulu-Natal</SelectItem>
                            <SelectItem value="LP">Limpopo</SelectItem>
                            <SelectItem value="MP">Mpumalanga</SelectItem>
                            <SelectItem value="NW">North West</SelectItem>
                            <SelectItem value="NC">Northern Cape</SelectItem>
                            <SelectItem value="WC">Western Cape</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="zipCode">Postal Code</Label>
                      <Input
                        id="zipCode"
                        value={formData.zipCode}
                        onChange={(e) => handleInputChange("zipCode", e.target.value)}
                        placeholder="0001"
                        required
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Shipping Method */}
                  <div className="space-y-4">
                    <h3 className="font-medium flex items-center">
                      <Truck className="mr-2 h-4 w-4" />
                      Shipping Method
                    </h3>
                    <RadioGroup value={shippingMethod} onValueChange={setShippingMethod}>
                      <div className="flex items-center space-x-2 p-3 border rounded-md">
                        <RadioGroupItem value="standard" id="standard" />
                        <Label htmlFor="standard" className="flex-1 cursor-pointer">
                          <div className="flex justify-between">
                            <div>
                              <p className="font-medium">Standard Shipping</p>
                              <p className="text-sm text-muted-foreground">5-7 business days</p>
                            </div>
                            <span className="font-medium">{totalPrice > 50 ? "Free" : "R9.99"}</span>
                          </div>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 p-3 border rounded-md">
                        <RadioGroupItem value="express" id="express" />
                        <Label htmlFor="express" className="flex-1 cursor-pointer">
                          <div className="flex justify-between">
                            <div>
                              <p className="font-medium">Express Shipping</p>
                              <p className="text-sm text-muted-foreground">2-3 business days</p>
                            </div>
                            <span className="font-medium">R19.99</span>
                          </div>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <Separator />

                  {/* Payment Method */}
                  <div className="space-y-4">
                    <h3 className="font-medium">Payment Method</h3>
                    <div className="p-4 border rounded-md bg-muted/50">
                      <div className="flex items-center space-x-3">
                        <CreditCard className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium">PayFast Payment Gateway</p>
                          <p className="text-sm text-muted-foreground">
                            Secure payment processing via PayFast. You'll be redirected to complete your payment.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      PayFast accepts all major credit cards, debit cards, and instant EFT.
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="saveInfo"
                      checked={formData.saveInfo}
                      onCheckedChange={(checked) => handleInputChange("saveInfo", checked as boolean)}
                    />
                    <Label htmlFor="saveInfo" className="text-sm">
                      Save this information for next time
                    </Label>
                  </div>

                  <Button type="submit" className="w-full" size="lg" disabled={isProcessing}>
                    {isProcessing ? "Redirecting to PayFast..." : `Pay R${finalTotal.toFixed(2)} with PayFast`}
                  </Button>
                </form>

                {/* Hidden PayFast form that auto-submits */}
                {payfastData && payfastUrl && (
                  <form ref={payfastFormRef} action={payfastUrl} method="POST" style={{ display: "none" }}>
                    {Object.entries(payfastData).map(([key, value]) => (
                      <input key={key} type="hidden" name={key} value={value} />
                    ))}
                  </form>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Qty: {item.quantity} × R{item.price}
                        </p>
                      </div>
                      <span className="font-medium">R{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal ({totalItems} items)</span>
                    <span>R{totalPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipping</span>
                    <span>{shippingCost === 0 ? "Free" : `R${shippingCost.toFixed(2)}`}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-medium text-lg">
                    <span>Total</span>
                    <span>R{finalTotal.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center space-x-2">
                    <Shield className="h-4 w-4 text-green-600" />
                    <span>Secure SSL encryption</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>30-day return policy</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>Quality guarantee</span>
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
