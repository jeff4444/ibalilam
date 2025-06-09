"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  Cpu,
  Star,
  ShoppingCart,
  Heart,
  Share2,
  MessageCircle,
  Shield,
  Truck,
  RotateCcw,
  ChevronLeft,
  Plus,
  Minus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useCartStore } from "@/lib/cart-store"
import { CartButton } from "@/components/cart-button"

export default function PartDetailPage() {
  const [quantity, setQuantity] = useState(1)
  const [selectedImage, setSelectedImage] = useState(0)

  // Mock data - in real app, this would be fetched based on the ID
  const part = {
    id: 1,
    name: "Arduino Uno R3 - Original",
    description:
      "The Arduino Uno R3 is a microcontroller board based on the ATmega328P. It has 14 digital input/output pins, 6 analog inputs, a 16 MHz ceramic resonator, a USB connection, a power jack, an ICSP header and a reset button.",
    price: 25.99,
    originalPrice: 35.99,
    category: "Microcontrollers",
    condition: "New",
    seller: {
      id: "seller-1",
      name: "TechParts Pro",
      rating: 4.8,
      reviews: 127,
      avatar: "/placeholder.svg?height=40&width=40",
    },
    rating: 4.8,
    reviews: 89,
    stock: 15,
    images: [
      "/placeholder.svg?height=400&width=400",
      "/placeholder.svg?height=400&width=400",
      "/placeholder.svg?height=400&width=400",
      "/placeholder.svg?height=400&width=400",
    ],
    specifications: {
      Microcontroller: "ATmega328P",
      "Operating Voltage": "5V",
      "Input Voltage": "7-12V",
      "Digital I/O Pins": "14",
      "Analog Input Pins": "6",
      "Flash Memory": "32KB",
      SRAM: "2KB",
      EEPROM: "1KB",
      "Clock Speed": "16MHz",
    },
    features: [
      "USB connectivity for easy programming",
      "Built-in LED on pin 13",
      "Reset button for easy restart",
      "ICSP header for advanced programming",
      "Compatible with Arduino IDE",
      "Extensive library support",
    ],
    isRefurbished: false,
    refurbishmentDetails: null,
  }

  const reviews = [
    {
      id: 1,
      user: "John D.",
      rating: 5,
      date: "2024-01-10",
      comment:
        "Excellent quality Arduino board. Works perfectly for my IoT projects. Fast shipping and great packaging.",
      verified: true,
    },
    {
      id: 2,
      user: "Sarah M.",
      rating: 4,
      date: "2024-01-08",
      comment: "Good product, exactly as described. The seller was very responsive to my questions.",
      verified: true,
    },
    {
      id: 3,
      user: "Mike R.",
      rating: 5,
      date: "2024-01-05",
      comment: "Perfect for beginners. Came with clear documentation and works great with the Arduino IDE.",
      verified: false,
    },
  ]

  const relatedParts = [
    {
      id: 2,
      name: "ESP32 Development Board",
      price: 12.5,
      image: "/placeholder.svg?height=100&width=100",
      rating: 4.9,
    },
    {
      id: 3,
      name: "Raspberry Pi 4 Model B",
      price: 75.0,
      image: "/placeholder.svg?height=100&width=100",
      rating: 4.8,
    },
    {
      id: 4,
      name: "Breadboard Kit",
      price: 8.99,
      image: "/placeholder.svg?height=100&width=100",
      rating: 4.6,
    },
  ]

  const addToCart = useCartStore((state) => state.addItem)

  const handleAddToCart = () => {
    addToCart({
      id: part.id,
      name: part.name,
      price: part.price,
      image: part.images[0],
      seller: part.seller.name,
      condition: part.condition,
      stock: part.stock,
      quantity: quantity,
    })
    // You could add a toast notification here
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="px-4 lg:px-6 h-14 flex items-center border-b">
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

      <div className="flex-1">
        <div className="container mx-auto px-4 py-6">
          {/* Breadcrumb */}
          <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
            <Link href="/parts" className="hover:text-foreground flex items-center">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Parts
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Product Images */}
            <div className="space-y-4">
              <div className="aspect-square rounded-lg border overflow-hidden">
                <Image
                  src={part.images[selectedImage] || "/placeholder.svg"}
                  alt={part.name}
                  width={500}
                  height={500}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {part.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`aspect-square rounded-md border overflow-hidden ${
                      selectedImage === index ? "ring-2 ring-primary" : ""
                    }`}
                  >
                    <Image
                      src={image || "/placeholder.svg"}
                      alt={`${part.name} view ${index + 1}`}
                      width={100}
                      height={100}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Product Info */}
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">{part.category}</Badge>
                  {part.isRefurbished && <Badge variant="secondary">Refurbished</Badge>}
                </div>
                <h1 className="text-3xl font-bold mb-2">{part.name}</h1>
                <div className="flex items-center space-x-4 mb-4">
                  <div className="flex items-center space-x-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium">{part.rating}</span>
                    <span className="text-muted-foreground">({part.reviews} reviews)</span>
                  </div>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-sm text-muted-foreground">{part.stock} in stock</span>
                </div>
                <p className="text-muted-foreground">{part.description}</p>
              </div>

              {/* Price */}
              <div className="space-y-2">
                <div className="flex items-baseline space-x-2">
                  <span className="text-3xl font-bold">${part.price}</span>
                  {part.originalPrice > part.price && (
                    <span className="text-lg text-muted-foreground line-through">${part.originalPrice}</span>
                  )}
                  {part.originalPrice > part.price && (
                    <Badge variant="destructive">Save ${(part.originalPrice - part.price).toFixed(2)}</Badge>
                  )}
                </div>
              </div>

              {/* Seller Info */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <Avatar>
                      <AvatarImage src={part.seller.avatar || "/placeholder.svg"} />
                      <AvatarFallback>{part.seller.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h4 className="font-medium">{part.seller.name}</h4>
                      <div className="flex items-center space-x-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm">{part.seller.rating}</span>
                        <span className="text-sm text-muted-foreground">({part.seller.reviews} reviews)</span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/contact/${part.seller.id}`}>
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Contact
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Quantity and Actions */}
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">Quantity:</span>
                    <div className="flex items-center border rounded-md">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        disabled={quantity <= 1}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="px-3 py-1 text-sm font-medium">{quantity}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setQuantity(Math.min(part.stock, quantity + 1))}
                        disabled={quantity >= part.stock}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <Button className="flex-1" size="lg" onClick={handleAddToCart}>
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Add to Cart
                  </Button>
                  <Button variant="outline" size="lg">
                    <Heart className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="lg">
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Guarantees */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="text-center">
                  <Shield className="h-6 w-6 mx-auto mb-2 text-green-600" />
                  <p className="text-xs font-medium">Quality Guarantee</p>
                </div>
                <div className="text-center">
                  <Truck className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                  <p className="text-xs font-medium">Fast Shipping</p>
                </div>
                <div className="text-center">
                  <RotateCcw className="h-6 w-6 mx-auto mb-2 text-purple-600" />
                  <p className="text-xs font-medium">30-Day Returns</p>
                </div>
              </div>
            </div>
          </div>

          {/* Product Details Tabs */}
          <Tabs defaultValue="specifications" className="mb-8">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="specifications">Specifications</TabsTrigger>
              <TabsTrigger value="features">Features</TabsTrigger>
              <TabsTrigger value="reviews">Reviews ({part.reviews})</TabsTrigger>
            </TabsList>

            <TabsContent value="specifications" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Technical Specifications</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(part.specifications).map(([key, value]) => (
                      <div key={key} className="flex justify-between py-2 border-b">
                        <span className="font-medium">{key}</span>
                        <span className="text-muted-foreground">{value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="features" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Key Features</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {part.features.map((feature, index) => (
                      <li key={index} className="flex items-start space-x-2">
                        <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reviews" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Customer Reviews</CardTitle>
                  <CardDescription>See what other customers are saying about this product</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {reviews.map((review) => (
                    <div key={review.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{review.user}</span>
                          {review.verified && (
                            <Badge variant="secondary" className="text-xs">
                              Verified Purchase
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">{review.date}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-muted-foreground">{review.comment}</p>
                      <Separator />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Related Products */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Related Products</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedParts.map((relatedPart) => (
                <Card key={relatedPart.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <Image
                      src={relatedPart.image || "/placeholder.svg"}
                      alt={relatedPart.name}
                      width={100}
                      height={100}
                      className="w-full h-32 object-cover rounded-md mb-3"
                    />
                    <h3 className="font-medium mb-2 line-clamp-2">{relatedPart.name}</h3>
                    <div className="flex items-center justify-between">
                      <span className="font-bold">${relatedPart.price}</span>
                      <div className="flex items-center space-x-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs">{relatedPart.rating}</span>
                      </div>
                    </div>
                    <Button className="w-full mt-3" variant="outline" size="sm" asChild>
                      <Link href={`/parts/${relatedPart.id}`}>View Details</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
