"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
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
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useCartStore } from "@/lib/cart-store"
import { CartButton } from "@/components/cart-button"
import { usePart } from "@/hooks/use-part"

export default function PartDetailPage() {
  const params = useParams()
  const partId = params.id as string
  const [quantity, setQuantity] = useState(1)
  const [selectedImage, setSelectedImage] = useState(0)

  const { part, loading, error } = usePart(partId)
  const addToCart = useCartStore((state) => state.addItem)

  const handleAddToCart = () => {
    if (!part) return
    
    addToCart({
      id: part.id,
      name: part.name,
      price: part.price,
      image: part.image_url || "/placeholder.svg",
      seller: part.shop_name || "Unknown Seller",
      condition: part.part_type === 'refurbished' ? part.refurbished_condition || 'Refurbished' : 'Original',
      stock: part.stock_quantity,
      quantity: quantity,
    })
    // You could add a toast notification here
  }

  // Show loading state
  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
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
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading part details...</p>
          </div>
        </div>
      </div>
    )
  }

  // Show error state
  if (error || !part) {
    return (
      <div className="flex flex-col min-h-screen">
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
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Part Not Found</h2>
            <p className="text-muted-foreground mb-4">{error || "The part you're looking for doesn't exist."}</p>
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
                  src={part.image_url || "/placeholder.svg"}
                  alt={part.name}
                  width={500}
                  height={500}
                  className="w-full h-full object-cover"
                />
              </div>
              {/* For now, we'll show a single image. In the future, you could add multiple images */}
              <div className="text-center text-sm text-muted-foreground">
                {part.views} views
              </div>
            </div>

            {/* Product Info */}
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">{part.category}</Badge>
                  {part.part_type === 'refurbished' && <Badge variant="secondary">Refurbished</Badge>}
                  {part.stock_quantity === 0 && <Badge variant="destructive">Out of Stock</Badge>}
                </div>
                <h1 className="text-3xl font-bold mb-2">{part.name}</h1>
                <div className="flex items-center space-x-4 mb-4">
                  <div className="flex items-center space-x-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium">{part.shop_rating?.toFixed(1) || 'N/A'}</span>
                    <span className="text-muted-foreground">({part.shop_review_count || 0} reviews)</span>
                  </div>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-sm text-muted-foreground">{part.stock_quantity} in stock</span>
                </div>
                <p className="text-muted-foreground">{part.description}</p>
              </div>

              {/* Price */}
              <div className="space-y-2">
                <div className="flex items-baseline space-x-2">
                  <span className="text-3xl font-bold">${part.price.toFixed(2)}</span>
                  {part.part_type === 'refurbished' && part.cost && part.cost > 0 && (
                    <span className="text-lg text-muted-foreground line-through">${part.cost.toFixed(2)}</span>
                  )}
                  {part.part_type === 'refurbished' && part.cost && part.cost > 0 && (
                    <Badge variant="destructive">Save ${(part.cost - part.price).toFixed(2)}</Badge>
                  )}
                </div>
                {part.part_type === 'refurbished' && part.profit && (
                  <p className="text-sm text-green-600 font-medium">
                    Profit: ${part.profit.toFixed(2)}
                  </p>
                )}
              </div>

              {/* Seller Info */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <Avatar>
                      <AvatarImage src="/placeholder.svg" />
                      <AvatarFallback>{(part.shop_name || 'S').charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h4 className="font-medium">{part.shop_name || 'Unknown Shop'}</h4>
                      <div className="flex items-center space-x-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm">{part.shop_rating?.toFixed(1) || 'N/A'}</span>
                        <span className="text-sm text-muted-foreground">({part.shop_review_count || 0} reviews)</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {part.shop_total_sales || 0} sales • {part.shop_active_listings || 0} active listings
                      </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/contact/${part.shop_id}`}>
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
                        onClick={() => setQuantity(Math.min(part.stock_quantity, quantity + 1))}
                        disabled={quantity >= part.stock_quantity}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <Button 
                    className="flex-1" 
                    size="lg" 
                    onClick={handleAddToCart}
                    disabled={part.stock_quantity === 0}
                  >
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    {part.stock_quantity === 0 ? 'Out of Stock' : 'Add to Cart'}
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
          <Tabs defaultValue="details" className="mb-8">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="refurbishment">Refurbishment</TabsTrigger>
              <TabsTrigger value="reviews">Reviews ({part.reviews?.length || 0})</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Part Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex justify-between py-2 border-b">
                      <span className="font-medium">Category</span>
                      <span className="text-muted-foreground">{part.category}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="font-medium">Part Type</span>
                      <span className="text-muted-foreground capitalize">{part.part_type}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="font-medium">Status</span>
                      <span className="text-muted-foreground capitalize">{part.status}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="font-medium">Stock Quantity</span>
                      <span className="text-muted-foreground">{part.stock_quantity}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="font-medium">Views</span>
                      <span className="text-muted-foreground">{part.views}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="font-medium">Created</span>
                      <span className="text-muted-foreground">
                        {new Date(part.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="refurbishment" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Refurbishment Details</CardTitle>
                </CardHeader>
                <CardContent>
                  {part.part_type === 'refurbished' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex justify-between py-2 border-b">
                        <span className="font-medium">Original Condition</span>
                        <span className="text-muted-foreground capitalize">{part.original_condition || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="font-medium">Refurbished Condition</span>
                        <span className="text-muted-foreground capitalize">{part.refurbished_condition || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="font-medium">Time Spent</span>
                        <span className="text-muted-foreground">
                          {part.time_spent_hours ? `${part.time_spent_hours} hours` : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="font-medium">Refurbishment Cost</span>
                        <span className="text-muted-foreground">
                          {part.cost ? `$${part.cost.toFixed(2)}` : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="font-medium">Profit</span>
                        <span className="text-muted-foreground">
                          {part.profit ? `$${part.profit.toFixed(2)}` : 'N/A'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">This is an original part, not refurbished.</p>
                  )}
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
                  {part.reviews && part.reviews.length > 0 ? (
                    part.reviews.map((review) => (
                      <div key={review.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{review.user_name}</span>
                            {review.is_verified_buyer && (
                              <Badge variant="secondary" className="text-xs">
                                Verified Purchase
                              </Badge>
                            )}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {new Date(review.created_at).toLocaleDateString()}
                          </span>
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
                    ))
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No reviews yet. Be the first to review this part!</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Related Products */}
          {part.related_parts && part.related_parts.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Related Products</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {part.related_parts.map((relatedPart) => (
                  <Card key={relatedPart.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <Image
                        src={relatedPart.image_url || "/placeholder.svg"}
                        alt={relatedPart.name}
                        width={100}
                        height={100}
                        className="w-full h-32 object-cover rounded-md mb-3"
                      />
                      <h3 className="font-medium mb-2 line-clamp-2">{relatedPart.name}</h3>
                      <div className="flex items-center justify-between">
                        <span className="font-bold">${relatedPart.price.toFixed(2)}</span>
                        <div className="flex items-center space-x-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-xs">{relatedPart.shop_rating.toFixed(1)}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <Badge variant="outline" className="text-xs">
                          {relatedPart.part_type === 'refurbished' ? 'Refurbished' : 'Original'}
                        </Badge>
                      </div>
                      <Button className="w-full mt-3" variant="outline" size="sm" asChild>
                        <Link href={`/parts/${relatedPart.id}`}>View Details</Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
