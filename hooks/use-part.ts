import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'

export interface PartDetail {
  id: string
  name: string
  description: string | null
  category: string
  price: number
  cost: number | null
  stock_quantity: number
  status: 'active' | 'inactive' | 'out_of_stock' | 'sold' | 'draft'
  part_type: 'original' | 'refurbished'
  original_condition: string | null
  refurbished_condition: string | null
  time_spent_hours: number | null
  profit: number | null
  image_url: string | null
  views: number
  created_at: string
  updated_at: string
  published_at: string | null
  shop_id: string
  search_keywords: string[]
  // Shop information
  shop_name?: string
  shop_description?: string
  shop_rating?: number
  shop_review_count?: number
  shop_total_sales?: number
  shop_active_listings?: number
  // Reviews
  reviews?: Review[]
  // Related parts
  related_parts?: RelatedPart[]
}

export interface Review {
  id: string
  user_id: string
  user_name: string
  rating: number
  comment: string
  created_at: string
  is_verified_buyer: boolean
  status: 'pending' | 'approved'
}

export interface RelatedPart {
  id: string
  name: string
  price: number
  image_url: string | null
  shop_rating: number
  part_type: 'original' | 'refurbished'
}

export function usePart(partId: string) {
  const [part, setPart] = useState<PartDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const supabase = useMemo(() => createClient(), [])

  const fetchPart = useCallback(async () => {
    if (!partId) return

    try {
      setLoading(true)
      setError(null)

      // Fetch the main part data with shop information
      const { data: partData, error: partError } = await supabase
        .from('parts')
        .select(`
          *,
          shops!inner(
            name,
            description,
            rating,
            review_count,
            total_sales,
            active_listings
          )
        `)
        .eq('id', partId)
        .eq('status', 'active')
        .single()

      if (partError) {
        throw new Error(`Failed to fetch part: ${partError.message}`)
      }

      if (!partData) {
        throw new Error('Part not found')
      }

      // Transform the data to include shop information
      const transformedPart = {
        ...partData,
        shop_name: (partData.shops as any)?.name,
        shop_description: (partData.shops as any)?.description,
        shop_rating: (partData.shops as any)?.rating,
        shop_review_count: (partData.shops as any)?.review_count,
        shop_total_sales: (partData.shops as any)?.total_sales,
        shop_active_listings: (partData.shops as any)?.active_listings,
      }

      // Fetch reviews for this part (optional - table might not exist yet)
      let reviews: any[] = []
      try {
        const { data: reviewsData, error: reviewsError } = await supabase
          .from('reviews')
          .select(`
            id,
            user_id,
            rating,
            comment,
            created_at,
            is_verified_buyer,
            status
          `)
          .eq('part_id', partId)
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(10)

        if (reviewsError) {
          // If reviews table doesn't exist, just log and continue
          if (reviewsError.code === 'PGRST106') {
            console.log('Reviews table does not exist yet')
          } else {
            console.error('Error fetching reviews:', reviewsError)
          }
        } else {
          // Transform reviews data
          reviews = reviewsData?.map(review => ({
            id: review.id,
            user_id: review.user_id,
            user_name: 'Anonymous', // For now, we'll use Anonymous. In the future, you could fetch user names separately
            rating: review.rating,
            comment: review.comment,
            created_at: review.created_at,
            is_verified_buyer: review.is_verified_buyer,
            status: review.status,
          })) || []
        }
      } catch (err) {
        console.log('Reviews not available:', err)
        reviews = []
      }

      // Fetch related parts (same category, different part)
      let relatedParts: any[] = []
      try {
        const { data: relatedData, error: relatedError } = await supabase
          .from('parts')
          .select(`
            id,
            name,
            price,
            image_url,
            part_type,
            shops!inner(
              rating
            )
          `)
          .eq('category', partData.category)
          .neq('id', partId)
          .eq('status', 'active')
          .order('views', { ascending: false })
          .limit(3)

        if (relatedError) {
          console.error('Error fetching related parts:', relatedError)
        } else {
          // Transform related parts data
          relatedParts = relatedData?.map(relatedPart => ({
            id: relatedPart.id,
            name: relatedPart.name,
            price: relatedPart.price,
            image_url: relatedPart.image_url,
            shop_rating: (relatedPart.shops as any)?.rating || 0,
            part_type: relatedPart.part_type,
          })) || []
        }
      } catch (err) {
        console.log('Related parts not available:', err)
        relatedParts = []
      }

      // Update views count (optional - don't fail if this doesn't work)
      try {
        await supabase
          .from('parts')
          .update({ views: partData.views + 1 })
          .eq('id', partId)
      } catch (err) {
        console.log('Could not update view count:', err)
      }

      setPart({
        ...transformedPart,
        reviews,
        related_parts: relatedParts,
        views: partData.views + 1, // Update the view count locally
      })

    } catch (err: any) {
      console.error('Error fetching part:', err)
      setError(err.message || 'Failed to fetch part')
    } finally {
      setLoading(false)
    }
  }, [partId, supabase])

  useEffect(() => {
    fetchPart()
  }, [fetchPart])

  return {
    part,
    loading,
    error,
    refresh: fetchPart
  }
}
