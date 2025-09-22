"use client"

import { useState, useEffect } from "react"
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
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { useCartStore } from "@/lib/cart-store"
import { CartButton } from "@/components/cart-button"
import { usePart } from "@/hooks/use-part"
import { useAuth } from "@/hooks/use-auth"
import { useMOQ } from "@/hooks/use-moq"
import { createClient } from "@/utils/supabase/client"

export default function PartDetailPage() {
  const params = useParams()
  const partId = params.id as string
  const [quantity, setQuantity] = useState(1)
  const [selectedImage, setSelectedImage] = useState(0)
  const [isLiked, setIsLiked] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [shareSuccess, setShareSuccess] = useState(false)
  const [quantityError, setQuantityError] = useState("")
  const [priceTiers, setPriceTiers] = useState<Array<{ min_qty: number; unit_price: number }>>([])

  const { part, loading, error } = usePart(partId)
  const addToCart = useCartStore((state) => state.addItem)
  const { toast } = useToast()
  const { user } = useAuth()
  const { getPriceTiers } = useMOQ()
  const supabase = createClient()

  // Function to validate quantity based on MOQ rules
  const validateQuantity = (qty: number) => {
    if (!part) return { isValid: true, error: "", suggestedQty: qty }
    
    const moq = part.moq_units || 1
    const increment = part.order_increment || 1
    const packSize = part.pack_size_units
    
    let error = ""
    let suggestedQty = qty
    
    // Check minimum quantity
    if (qty < moq) {
      error += `Minimum order quantity is ${moq} units. `
      suggestedQty = moq
    }
    
    // Check pack size (takes precedence over order increment)
    if (packSize) {
      if (qty % packSize !== 0) {
        error += `Quantity must be in packs of ${packSize}. `
        suggestedQty = Math.ceil(qty / packSize) * packSize
      }
    } else {
      // Check order increment only if no pack size
      if (qty % increment !== 0) {
        error += `Quantity must be in increments of ${increment}. `
        suggestedQty = Math.ceil(qty / increment) * increment
      }
    }
    
    // Ensure suggested quantity meets MOQ
    if (suggestedQty < moq) {
      suggestedQty = moq
    }
    
    return {
      isValid: error === "",
      error: error.trim(),
      suggestedQty
    }
  }

  // Load liked status from database on component mount
  useEffect(() => {
    const checkIfLiked = async () => {
      if (!partId || !user?.id) {
        // If no user, fallback to localStorage
        const likedItems = JSON.parse(localStorage.getItem('likedItems') || '[]')
        setIsLiked(likedItems.includes(partId))
        return
      }

      try {
        const { data, error } = await supabase
          .from('user_favorites')
          .select('id')
          .eq('user_id', user.id)
          .eq('part_id', partId)
          .maybeSingle()

        if (error) {
          console.error('Error checking favorite status:', error)
          // Fallback to localStorage on error
          const likedItems = JSON.parse(localStorage.getItem('likedItems') || '[]')
          setIsLiked(likedItems.includes(partId))
        } else {
          setIsLiked(!!data)
        }
      } catch (err) {
        console.error('Error checking favorite status:', err)
        // Fallback to localStorage on error
        const likedItems = JSON.parse(localStorage.getItem('likedItems') || '[]')
        setIsLiked(likedItems.includes(partId))
      }
    }

    checkIfLiked()
  }, [partId, user?.id, supabase])

  // Initialize quantity based on MOQ when part loads
  useEffect(() => {
    if (part) {
      const moq = part.moq_units || 1
      setQuantity(moq)
      setQuantityError("")
    }
  }, [part])

  // Fetch price tiers for phone parts and accessories
  useEffect(() => {
    const fetchPriceTiers = async () => {
      if (part && (part.category === 'phone_parts' || part.category === 'phone_accessories')) {
        try {
          const tiers = await getPriceTiers(part.id)
          setPriceTiers(tiers)
        } catch (error) {
          console.error('Error fetching price tiers:', error)
        }
      }
    }

    fetchPriceTiers()
  }, [part, getPriceTiers])

  const handleAddToCart = () => {
    if (!part) return
    
    // Validate quantity before adding to cart
    const validation = validateQuantity(quantity)
    if (!validation.isValid) {
      setQuantityError(validation.error)
      toast({
        title: "Invalid quantity",
        description: validation.error,
        variant: "destructive",
      })
      return
    }
    
    // Clear any previous errors
    setQuantityError("")
    
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
    
    toast({
      title: "Added to cart",
      description: `${part.name} has been added to your cart.`,
    })
  }

  const handleLike = async () => {
    if (!partId) return

    if (!user?.id) {
      // If no user logged in, use localStorage as fallback
      const likedItems = JSON.parse(localStorage.getItem('likedItems') || '[]')
      
      if (isLiked) {
        const updatedLikedItems = likedItems.filter((id: string) => id !== partId)
        localStorage.setItem('likedItems', JSON.stringify(updatedLikedItems))
        setIsLiked(false)
        toast({
          title: "Removed from favorites",
          description: `${part?.name} has been removed from your favorites.`,
        })
      } else {
        const updatedLikedItems = [...likedItems, partId]
        localStorage.setItem('likedItems', JSON.stringify(updatedLikedItems))
        setIsLiked(true)
        toast({
          title: "Added to favorites",
          description: `${part?.name} has been added to your favorites.`,
        })
      }
      return
    }

    try {
      if (isLiked) {
        // Remove from database
        const { error } = await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('part_id', partId)

        if (error) throw error

        setIsLiked(false)
        toast({
          title: "Removed from favorites",
          description: `${part?.name} has been removed from your favorites.`,
        })
      } else {
        // Add to database
        const { error } = await supabase
          .from('user_favorites')
          .insert({
            user_id: user.id,
            part_id: partId,
          })

        if (error) throw error

        setIsLiked(true)
        toast({
          title: "Added to favorites",
          description: `${part?.name} has been added to your favorites.`,
        })
      }
    } catch (error) {
      console.error('Error updating favorite:', error)
      toast({
        title: "Error",
        description: "Failed to update favorites. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleShare = async () => {
    if (!part) return

    setIsSharing(true)
    
    try {
      const url = window.location.href
      
      // Check if clipboard API is available
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url)
      } else {
        // Fallback method for older browsers or non-secure contexts
        const textArea = document.createElement('textarea')
        textArea.value = url
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        
        try {
          document.execCommand('copy')
        } catch (fallbackError) {
          console.error('Fallback copy failed:', fallbackError)
          throw new Error('Copy not supported')
        } finally {
          document.body.removeChild(textArea)
        }
      }
      
      setShareSuccess(true)
      toast({
        title: "Link copied",
        description: "The part link has been copied to your clipboard.",
      })
    } catch (error) {
      console.error('Error copying to clipboard:', error)
      toast({
        title: "Copy failed",
        description: "Unable to copy the link. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSharing(false)
      // Reset success state after 2 seconds
      setTimeout(() => setShareSuccess(false), 2000)
    }
  }

  // Show loading state
  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
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
          <span className="font-bold text-xl">Techafon</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6 items-center">
          <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/parts">
            Browse Parts
          </Link>
          <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/favorites">
            Favorites
          </Link>
          <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/messages">
            Messages
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
                  src={
                    part.images && part.images.length > 0 
                      ? part.images[selectedImage] 
                      : part.image_url || "/placeholder.svg"
                  }
                  alt={part.name}
                  width={500}
                  height={500}
                  className="w-full h-full object-cover"
                />
              </div>
              
              {/* Multiple images if available */}
              {part.images && part.images.length > 1 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {selectedImage + 1} of {part.images.length} images
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {part.images.map((image, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedImage(index)}
                        className={`aspect-square rounded-lg border overflow-hidden transition-all ${
                          selectedImage === index 
                            ? 'ring-2 ring-blue-500 border-blue-500' 
                            : 'hover:border-gray-300'
                        }`}
                      >
                        <Image
                          src={image}
                          alt={`${part.name} - Image ${index + 1}`}
                          width={100}
                          height={100}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Show image count if there are multiple images */}
              {part.images && part.images.length > 1 && (
                <div className="flex justify-center space-x-2">
                  {part.images.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImage(index)}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        selectedImage === index ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
              )}
              
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
                  {part.location_city && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-sm text-muted-foreground">{part.location_city}</span>
                    </>
                  )}
                </div>
                <p className="text-muted-foreground">{part.description}</p>
              </div>

              {/* Price */}
              <div className="space-y-2">
                <div className="flex items-baseline space-x-2">
                  <span className="text-3xl font-bold">R{part.price.toFixed(2)}</span>
                  {part.part_type === 'refurbished' && part.cost && part.cost > 0 && (
                    <span className="text-lg text-muted-foreground line-through">R{part.cost.toFixed(2)}</span>
                  )}
                  {part.part_type === 'refurbished' && part.cost && part.cost > 0 && (
                    <Badge variant="destructive">Save R{(part.cost - part.price).toFixed(2)}</Badge>
                  )}
                </div>
                {part.part_type === 'refurbished' && part.profit && (
                  <p className="text-sm text-green-600 font-medium">
                    Profit: R{part.profit.toFixed(2)}
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
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        // Navigate to messages page with this part's chat
                        window.location.href = `/messages?part=${part.id}`
                      }}
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Message Seller
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
                        onClick={() => {
                          const newQty = Math.max(1, quantity - 1)
                          const validation = validateQuantity(newQty)
                          setQuantity(validation.suggestedQty)
                          setQuantityError(validation.error)
                        }}
                        disabled={quantity <= 1}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="px-3 py-1 text-sm font-medium">{quantity}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newQty = Math.min(part.stock_quantity, quantity + 1)
                          const validation = validateQuantity(newQty)
                          setQuantity(validation.suggestedQty)
                          setQuantityError(validation.error)
                        }}
                        disabled={quantity >= part.stock_quantity}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                
                {/* MOQ Information for phone parts and accessories */}
                {(part.category === 'phone_parts' || part.category === 'phone_accessories') && (
                  <div className="text-sm text-muted-foreground">
                    <p>Min order: {part.moq_units || 1} units</p>
                    {part.pack_size_units && (
                      <p>Pack size: {part.pack_size_units} units per pack</p>
                    )}
                    {!part.pack_size_units && part.order_increment && part.order_increment > 1 && (
                      <p>Order in increments of: {part.order_increment} units</p>
                    )}
                  </div>
                )}
                
                {/* Quantity Error */}
                {quantityError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{quantityError}</AlertDescription>
                  </Alert>
                )}

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
                  <Button 
                    variant="outline" 
                    size="lg"
                    onClick={handleLike}
                    className={isLiked ? "text-red-500 border-red-500 hover:bg-red-50" : ""}
                  >
                    <Heart className={`h-4 w-4 ${isLiked ? "fill-current" : ""}`} />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="lg"
                    onClick={handleShare}
                    disabled={isSharing}
                    className={shareSuccess ? "text-green-500 border-green-500 hover:bg-green-50" : ""}
                  >
                    {shareSuccess ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Share2 className="h-4 w-4" />
                    )}
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
              {(part.category === 'phone_parts' || part.category === 'phone_accessories') && (
                <TabsTrigger value="moq">Order Info</TabsTrigger>
              )}
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
                      <span className="text-muted-foreground">{part.category.replace('_', ' ')}</span>
                    </div>
                    {part.subcategory && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="font-medium">Subcategory</span>
                        <span className="text-muted-foreground capitalize">{part.subcategory.replace('_', ' ')}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-2 border-b">
                      <span className="font-medium">Part Type</span>
                      <span className="text-muted-foreground capitalize">{part.part_type}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="font-medium">Status</span>
                      <span className="text-muted-foreground capitalize">{part.status}</span>
                    </div>
                    {part.brand && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="font-medium">Brand</span>
                        <span className="text-muted-foreground">{part.brand}</span>
                      </div>
                    )}
                    {part.model && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="font-medium">Model</span>
                        <span className="text-muted-foreground">{part.model}</span>
                      </div>
                    )}
                    {part.location_city && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="font-medium">Location</span>
                        <span className="text-muted-foreground">{part.location_city}{part.location_town && `, ${part.location_town}`}</span>
                      </div>
                    )}
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
                  
                  {/* Category-specific fields */}
                  {part.category === 'mobile_phones' && (
                    <div className="mt-6 pt-4 border-t">
                      <h4 className="font-medium mb-3">Phone Specifications</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {part.storage_capacity && (
                          <div className="flex justify-between py-2 border-b">
                            <span className="font-medium">Storage Capacity</span>
                            <span className="text-muted-foreground">{part.storage_capacity}</span>
                          </div>
                        )}
                        {part.imei && (
                          <div className="flex justify-between py-2 border-b">
                            <span className="font-medium">IMEI</span>
                            <span className="text-muted-foreground font-mono text-xs">{part.imei}</span>
                          </div>
                        )}
                        {part.network_status && (
                          <div className="flex justify-between py-2 border-b">
                            <span className="font-medium">Network Status</span>
                            <span className="text-muted-foreground capitalize">{part.network_status}</span>
                          </div>
                        )}
                        <div className="flex justify-between py-2 border-b">
                          <span className="font-medium">Includes Box</span>
                          <span className="text-muted-foreground">{part.has_box ? 'Yes' : 'No'}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b">
                          <span className="font-medium">Includes Charger</span>
                          <span className="text-muted-foreground">{part.has_charger ? 'Yes' : 'No'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {part.category === 'phone_parts' && (
                    <div className="mt-6 pt-4 border-t">
                      <h4 className="font-medium mb-3">Part Specifications</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {part.part_type_detail && (
                          <div className="flex justify-between py-2 border-b">
                            <span className="font-medium">Part Type</span>
                            <span className="text-muted-foreground capitalize">{part.part_type_detail.replace('_', ' ')}</span>
                          </div>
                        )}
                        {part.model_compatibility && (
                          <div className="flex justify-between py-2 border-b">
                            <span className="font-medium">Model Compatibility</span>
                            <span className="text-muted-foreground">{part.model_compatibility}</span>
                          </div>
                        )}
                        {part.moq && (
                          <div className="flex justify-between py-2 border-b">
                            <span className="font-medium">Minimum Order Quantity</span>
                            <span className="text-muted-foreground">{part.moq} units</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {part.category === 'phone_accessories' && (
                    <div className="mt-6 pt-4 border-t">
                      <h4 className="font-medium mb-3">Accessory Specifications</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {part.accessory_type && (
                          <div className="flex justify-between py-2 border-b">
                            <span className="font-medium">Accessory Type</span>
                            <span className="text-muted-foreground capitalize">{part.accessory_type.replace('_', ' ')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {part.category === 'laptops' && (
                    <div className="mt-6 pt-4 border-t">
                      <h4 className="font-medium mb-3">Laptop Specifications</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {part.cpu && (
                          <div className="flex justify-between py-2 border-b">
                            <span className="font-medium">CPU</span>
                            <span className="text-muted-foreground">{part.cpu}</span>
                          </div>
                        )}
                        {part.ram && (
                          <div className="flex justify-between py-2 border-b">
                            <span className="font-medium">RAM</span>
                            <span className="text-muted-foreground">{part.ram}</span>
                          </div>
                        )}
                        {part.storage && (
                          <div className="flex justify-between py-2 border-b">
                            <span className="font-medium">Storage</span>
                            <span className="text-muted-foreground">{part.storage}</span>
                          </div>
                        )}
                        {part.screen_size && (
                          <div className="flex justify-between py-2 border-b">
                            <span className="font-medium">Screen Size</span>
                            <span className="text-muted-foreground">{part.screen_size}</span>
                          </div>
                        )}
                        {part.battery_health && (
                          <div className="flex justify-between py-2 border-b">
                            <span className="font-medium">Battery Health</span>
                            <span className="text-muted-foreground">{part.battery_health}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {part.category === 'steam_kits' && (
                    <div className="mt-6 pt-4 border-t">
                      <h4 className="font-medium mb-3">STEAM Kit Specifications</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {part.kit_type && (
                          <div className="flex justify-between py-2 border-b">
                            <span className="font-medium">Kit Type</span>
                            <span className="text-muted-foreground capitalize">{part.kit_type}</span>
                          </div>
                        )}
                        {part.age_group && (
                          <div className="flex justify-between py-2 border-b">
                            <span className="font-medium">Age Group</span>
                            <span className="text-muted-foreground">{part.age_group}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {part.category === 'other_electronics' && (
                    <div className="mt-6 pt-4 border-t">
                      <h4 className="font-medium mb-3">Electronics Specifications</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {part.electronics_subcategory && (
                          <div className="flex justify-between py-2 border-b">
                            <span className="font-medium">Subcategory</span>
                            <span className="text-muted-foreground capitalize">{part.electronics_subcategory}</span>
                          </div>
                        )}
                        {part.key_specs && (
                          <div className="flex justify-between py-2 border-b">
                            <span className="font-medium">Key Specifications</span>
                            <span className="text-muted-foreground">{part.key_specs}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
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
                          {part.cost ? `R${part.cost.toFixed(2)}` : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="font-medium">Profit</span>
                        <span className="text-muted-foreground">
                          {part.profit ? `R${part.profit.toFixed(2)}` : 'N/A'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">This is an original part, not refurbished.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {(part.category === 'phone_parts' || part.category === 'phone_accessories') && (
              <TabsContent value="moq" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Order Quantity Information</CardTitle>
                    <CardDescription>Minimum order requirements and quantity rules</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex justify-between py-2 border-b">
                        <span className="font-medium">Minimum Order Quantity (MOQ)</span>
                        <span className="text-muted-foreground">{part.moq_units || 1} units</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="font-medium">Order Increment</span>
                        <span className="text-muted-foreground">{part.order_increment || 1} units</span>
                      </div>
                      {part.pack_size_units && (
                        <div className="flex justify-between py-2 border-b">
                          <span className="font-medium">Pack Size</span>
                          <span className="text-muted-foreground">{part.pack_size_units} units per pack</span>
                        </div>
                      )}
                      <div className="flex justify-between py-2 border-b">
                        <span className="font-medium">Stock on Hand</span>
                        <span className="text-muted-foreground">{part.stock_on_hand_units || 0} units</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="font-medium">Backorders Allowed</span>
                        <span className="text-muted-foreground">
                          {part.backorder_allowed ? 'Yes' : 'No'}
                        </span>
                      </div>
                      {part.backorder_allowed && part.lead_time_days && (
                        <div className="flex justify-between py-2 border-b">
                          <span className="font-medium">Lead Time</span>
                          <span className="text-muted-foreground">{part.lead_time_days} days</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Price Tiers */}
                    {priceTiers.length > 0 && (
                      <div className="mt-6 pt-4 border-t">
                        <h4 className="font-medium mb-3">Volume Pricing</h4>
                        <div className="space-y-2">
                          {priceTiers.map((tier, index) => (
                            <div key={index} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-md">
                              <span className="font-medium">
                                {tier.min_qty}+ units
                              </span>
                              <span className="text-green-600 font-semibold">
                                R{tier.unit_price.toFixed(2)} per unit
                              </span>
                            </div>
                          ))}
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          Higher quantities may qualify for better pricing
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}

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
                        <span className="font-bold">R{relatedPart.price.toFixed(2)}</span>
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
