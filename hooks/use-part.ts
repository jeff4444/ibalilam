import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'

export interface PartDetail {
  id: string
  name: string
  description: string | null
  category: 'mobile_phones' | 'phone_parts' | 'phone_accessories' | 'laptops' | 'steam_kits' | 'other_electronics'
  subcategory: string | null
  brand: string | null
  model: string | null
  location_city: string | null
  location_town: string | null
  has_box: boolean | null
  has_charger: boolean | null
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
  images: string[] | null
  views: number
  created_at: string
  updated_at: string
  published_at: string | null
  shop_id: string
  search_keywords: string[]
  
  // Phone-specific fields
  storage_capacity: string | null
  imei: string | null
  network_status: string | null
  
  // Phone Parts specific fields
  part_type_detail: string | null // Screen/Battery/Charging Port/Camera/etc.
  model_compatibility: string | null // e.g., "Samsung A30"
  moq: number | null // Minimum Order Quantity
  
  // Phone Accessories specific fields
  accessory_type: string | null // Charger/Case/Earphones/etc.
  
  // Laptop specific fields
  cpu: string | null
  ram: string | null
  storage: string | null
  screen_size: string | null
  battery_health: number | null
  
  // STEAM Kits specific fields
  kit_type: string | null // Coding/Robotics/AI
  age_group: string | null
  
  // Other Electronics specific fields
  electronics_subcategory: string | null // TV/Audio/Gaming/Networking/Power
  key_specs: string | null
  
  // MOQ fields
  moq_units: number | null
  order_increment: number | null
  pack_size_units: number | null
  stock_on_hand_units: number | null
  backorder_allowed: boolean | null
  lead_time_days: number | null
  
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

// Query keys for cache management
export const partQueryKeys = {
  all: ['part'] as const,
  detail: (partId: string) => ['part', 'detail', partId] as const,
}

// Fetch function for a single part
async function fetchPart(supabase: ReturnType<typeof createClient>, partId: string): Promise<PartDetail> {
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

  // Note: Reviews are at the shop level, not part level
  // Shop reviews can be viewed on the seller's contact/profile page
  const reviews: Review[] = []

  // Fetch related parts (same category, different part)
  let relatedParts: RelatedPart[] = []
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

    if (!relatedError && relatedData) {
      // Transform related parts data
      relatedParts = relatedData.map(relatedPart => ({
        id: relatedPart.id,
        name: relatedPart.name,
        price: relatedPart.price,
        image_url: relatedPart.image_url,
        shop_rating: (relatedPart.shops as any)?.rating || 0,
        part_type: relatedPart.part_type,
      }))
    }
  } catch (err) {
    console.log('Related parts not available:', err)
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

  return {
    ...transformedPart,
    reviews,
    related_parts: relatedParts,
    views: partData.views + 1, // Update the view count locally
  }
}

export function usePart(partId: string) {
  const queryClient = useQueryClient()
  const supabase = useMemo(() => createClient(), [])

  // Query for part data with 5-minute stale time
  const {
    data: part = null,
    isLoading: loading,
    error: queryError,
    refetch
  } = useQuery({
    queryKey: partQueryKeys.detail(partId),
    queryFn: () => fetchPart(supabase, partId),
    enabled: !!partId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes cache
  })

  const refresh = useCallback(() => {
    refetch()
  }, [refetch])

  // Convert error to string
  const error = queryError ? (queryError as Error).message : null

  return {
    part,
    loading,
    error,
    refresh
  }
}
