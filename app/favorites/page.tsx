"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  Cpu,
  Heart,
  ShoppingCart,
  Star,
  Eye,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/hooks/use-auth"
import { useCartStore } from "@/lib/cart-store"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/utils/supabase/client"
import { CartButton } from "@/components/cart-button"

interface FavoritePart {
  id: string
  name: string
  description: string | null
  category: string
  price: number
  stock_quantity: number
  status: string
  part_type: 'original' | 'refurbished'
  image_url: string | null
  views: number
  shop_name: string | null
  shop_rating: number | null
  shop_review_count: number | null
  created_at: string
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoritePart[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const { user, loading: authLoading } = useAuth()
  const addToCart = useCartStore((state) => state.addItem)
  const { toast } = useToast()
  const router = useRouter()
  const supabase = createClient()

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  // Load favorites from database
  useEffect(() => {
    const loadFavorites = async () => {
      if (!user?.id) {
        // If no user, load from localStorage
        const likedItems = JSON.parse(localStorage.getItem('likedItems') || '[]')
        if (likedItems.length === 0) {
          setFavorites([])
          setLoading(false)
          return
        }

        try {
          const { data, error } = await supabase
            .from('parts')
            .select(`
              id,
              name,
              description,
              category,
              price,
              stock_quantity,
              status,
              part_type,
              image_url,
              views,
              created_at,
              shops (
                name,
                rating,
                review_count
              )
            `)
            .in('id', likedItems)

          if (error) throw error

          const formattedData = data?.map(part => ({
            ...part,
            shop_name: part.shops?.name || null,
            shop_rating: part.shops?.rating || null,
            shop_review_count: part.shops?.review_count || null,
          })) || []

          setFavorites(formattedData)
        } catch (err) {
          console.error('Error loading favorites:', err)
          setError('Failed to load favorites')
        } finally {
          setLoading(false)
        }
        return
      }

      try {
        const { data, error } = await supabase
          .from('user_favorites')
          .select(`
            part_id,
            parts (
              id,
              name,
              description,
              category,
              price,
              stock_quantity,
              status,
              part_type,
              image_url,
              views,
              created_at,
              shops (
                name,
                rating,
                review_count
              )
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (error) throw error

        const formattedData = data?.map(fav => ({
          ...fav.parts,
          shop_name: fav.parts.shops?.name || null,
          shop_rating: fav.parts.shops?.rating || null,
          shop_review_count: fav.parts.shops?.review_count || null,
        })) || []

        setFavorites(formattedData)
      } catch (err) {
        console.error('Error loading favorites:', err)
        setError('Failed to load favorites')
      } finally {
        setLoading(false)
      }
    }

    if (user || !authLoading) {
      loadFavorites()
    }
  }, [user, authLoading, supabase])

  const handleRemoveFavorite = async (partId: string) => {
    setRemovingId(partId)

    try {
      if (!user?.id) {
        // Remove from localStorage
        const likedItems = JSON.parse(localStorage.getItem('likedItems') || '[]')
        const updatedLikedItems = likedItems.filter((id: string) => id !== partId)
        localStorage.setItem('likedItems', JSON.stringify(updatedLikedItems))
        
        setFavorites(prev => prev.filter(fav => fav.id !== partId))
        toast({
          title: "Removed from favorites",
          description: "The part has been removed from your favorites.",
        })
        return
      }

      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('part_id', partId)

      if (error) throw error

      setFavorites(prev => prev.filter(fav => fav.id !== partId))
      toast({
        title: "Removed from favorites",
        description: "The part has been removed from your favorites.",
      })
    } catch (err) {
      console.error('Error removing favorite:', err)
      toast({
        title: "Error",
        description: "Failed to remove from favorites. Please try again.",
        variant: "destructive",
      })
    } finally {
      setRemovingId(null)
    }
  }

  const handleAddToCart = (part: FavoritePart) => {
    addToCart({
      id: part.id,
      name: part.name,
      price: part.price,
      image: part.image_url || "/placeholder.svg",
      seller: part.shop_name || "Unknown Seller",
      condition: part.part_type === 'refurbished' ? 'Refurbished' : 'Original',
      stock: part.stock_quantity,
      quantity: 1,
    })
    
    toast({
      title: "Added to cart",
      description: `${part.name} has been added to your cart.`,
    })
  }

  // Show loading state
  if (authLoading || loading) {
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
            <p className="text-muted-foreground">Loading favorites...</p>
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

      <div className="flex-1 space-y-6 p-4 md:p-8">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">My Favorites</h1>
            <p className="text-muted-foreground">
              {favorites.length} {favorites.length === 1 ? 'item' : 'items'} saved
            </p>
          </div>
        </div>

        {favorites.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Heart className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No favorites yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Start browsing parts and click the heart icon to save your favorites.
              </p>
              <Button asChild>
                <Link href="/parts">Browse Parts</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {favorites.map((part) => (
              <Card key={part.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="relative">
                    <Image
                      src={part.image_url || "/placeholder.svg"}
                      alt={part.name}
                      width={300}
                      height={200}
                      className="w-full h-48 object-cover rounded-md mb-3"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2 h-8 w-8 p-0 bg-white/80 hover:bg-white"
                      onClick={() => handleRemoveFavorite(part.id)}
                      disabled={removingId === part.id}
                    >
                      <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{part.category}</Badge>
                      {part.part_type === 'refurbished' && (
                        <Badge variant="secondary">Refurbished</Badge>
                      )}
                      {part.stock_quantity === 0 && (
                        <Badge variant="destructive">Out of Stock</Badge>
                      )}
                    </div>
                    
                    <h3 className="font-semibold line-clamp-2">{part.name}</h3>
                    
                    {part.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {part.description}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold">${part.price.toFixed(2)}</span>
                      <div className="flex items-center space-x-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs">
                          {part.shop_rating?.toFixed(1) || 'N/A'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{part.shop_name || 'Unknown Shop'}</span>
                      <span>{part.views} views</span>
                    </div>
                    
                    <div className="flex space-x-2 pt-2">
                      <Button 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleAddToCart(part)}
                        disabled={part.stock_quantity === 0}
                      >
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        {part.stock_quantity === 0 ? 'Out of Stock' : 'Add to Cart'}
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/parts/${part.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
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
