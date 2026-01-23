import { useState, useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import { sanitizeSearchInput } from '@/lib/utils'

export interface Part {
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
  moq: number | null // Minimum Order Quantity (legacy)
  
  // MOQ and pricing fields
  moq_units: number | null
  order_increment: number | null
  pack_size_units: number | null
  stock_on_hand_units: number | null
  backorder_allowed: boolean | null
  lead_time_days: number | null
  
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
  
  // Shop information
  shop_name?: string
  shop_rating?: number
  shop_review_count?: number
  shop_user_id?: string
}

export interface PartsFilters {
  search: string
  categories: string[]
  subcategories: string[]
  brands: string[]
  models: string[]
  conditions: string[]
  priceRange: {
    min: number | null
    max: number | null
  }
  location: string
  sortBy: 'relevance' | 'price-low' | 'price-high' | 'rating' | 'newest' | 'most-viewed'
  ficaVerifiedOnly: boolean
  // Legacy fields for backward compatibility
  partTypes: string[]
}

export interface CategoryHierarchy {
  category: string
  subcategories: string[]
}

export interface PriceTier {
  id: string
  part_id: string
  min_qty: number
  unit_price: number
  created_at: string
  updated_at: string
}

export interface MOQValidation {
  is_valid: boolean
  error_message: string
  suggested_quantity: number
}

export interface TierPrice {
  unit_price: number
  total_price: number
  tier_name: string
}

export interface AvailableQuantity {
  in_stock: number
  backorder_available: boolean
  lead_time_days: number | null
}

// Query keys for cache management
export const partsQueryKeys = {
  all: ['parts'] as const,
  list: (filters: PartsFilters) => ['parts', 'list', filters] as const,
  categories: ['parts', 'categories'] as const,
}

// Fetch function for parts
async function fetchParts(supabase: ReturnType<typeof createClient>, filters: PartsFilters) {
  // Use direct query instead of RPC function since search_parts requires published_at IS NOT NULL
  // which may not be set for all parts
  let data, error

  let query = supabase
    .from('parts')
    .select(`
      *,
      shops!inner(
        name,
        rating,
        review_count,
        user_id
      )
    `)
    .eq('status', 'active')

  // Apply filters - only use columns that exist in the schema
  // SECURITY FIX: VULN-010 - Sanitize search input to prevent SQL injection
  // MED-003 FIX: Use strictMode for maximum safety against PostgREST filter injection
  const sanitizedSearch = sanitizeSearchInput(filters.search, { strictMode: true })
  if (sanitizedSearch) {
    // Search in name, description, and search_keywords (which contains brand, model, etc.)
    query = query.or(`name.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%`)
  }
  if (filters.categories.length > 0) {
    query = query.in('category', filters.categories)
  }
  // Note: subcategories, brands, and models filters are not directly supported
  // as those columns don't exist in the database schema
  // The data is stored in description and search_keywords instead
  // Location filtering is now supported via the location_city column
  if (filters.conditions.length > 0) {
    query = query.in('part_type', filters.conditions)
  }
  if (filters.priceRange.min !== null) {
    query = query.gte('price', filters.priceRange.min)
  }
  if (filters.priceRange.max !== null) {
    query = query.lte('price', filters.priceRange.max)
  }
  // Location filter - filter by location_city column
  // MED-003 FIX: Use strictMode for location filter as well
  if (filters.location) {
    const sanitizedLocation = sanitizeSearchInput(filters.location, { strictMode: true })
    if (sanitizedLocation) {
      query = query.ilike('location_city', `%${sanitizedLocation}%`)
    }
  }

  // Apply sorting
  switch (filters.sortBy) {
    case 'price-low':
      query = query.order('price', { ascending: true })
      break
    case 'price-high':
      query = query.order('price', { ascending: false })
      break
    case 'newest':
      query = query.order('created_at', { ascending: false })
      break
    case 'most-viewed':
      query = query.order('views', { ascending: false })
      break
    default:
      query = query.order('views', { ascending: false }).order('created_at', { ascending: false })
      break
  }

  const result = await query.limit(50)
  data = result.data
  error = result.error

  if (error) {
    throw new Error(`Failed to fetch parts: ${error.message}`)
  }

  // Transform the data to match our Part interface
  const transformedParts = data?.map((part: any) => {
    // Handle both RPC function result and traditional query result
    const isRpcResult = part.shop_name !== undefined
    const shopData = isRpcResult ? part : (part.shops as any)
    
    return {
      id: part.id,
      name: part.name,
      description: part.description,
      category: part.category,
      subcategory: part.subcategory || null,
      brand: part.brand || null,
      model: part.model || null,
      location_city: part.location_city || null,
      location_town: part.location_town || null,
      has_box: part.has_box || null,
      has_charger: part.has_charger || null,
      price: part.price,
      cost: part.cost || null,
      stock_quantity: part.stock_quantity,
      status: part.status || 'active',
      part_type: part.part_type,
      original_condition: part.original_condition || null,
      refurbished_condition: part.refurbished_condition || null,
      time_spent_hours: part.time_spent_hours || null,
      profit: part.profit || null,
      image_url: part.image_url,
      views: part.views || 0,
      created_at: part.created_at,
      updated_at: part.updated_at || part.created_at,
      published_at: part.published_at || part.created_at,
      shop_id: part.shop_id || '',
      search_keywords: part.search_keywords || [],
      storage_capacity: part.storage_capacity || null,
      imei: part.imei || null,
      network_status: part.network_status || null,
      part_type_detail: part.part_type_detail || null,
      model_compatibility: part.model_compatibility || null,
      moq: part.moq || null,
      moq_units: part.moq_units || null,
      order_increment: part.order_increment || null,
      pack_size_units: part.pack_size_units || null,
      stock_on_hand_units: part.stock_on_hand_units || null,
      backorder_allowed: part.backorder_allowed || null,
      lead_time_days: part.lead_time_days || null,
      accessory_type: part.accessory_type || null,
      cpu: part.cpu || null,
      ram: part.ram || null,
      storage: part.storage || null,
      screen_size: part.screen_size || null,
      battery_health: part.battery_health || null,
      kit_type: part.kit_type || null,
      age_group: part.age_group || null,
      electronics_subcategory: part.electronics_subcategory || null,
      key_specs: part.key_specs || null,
      shop_name: isRpcResult ? part.shop_name : shopData?.name,
      shop_rating: isRpcResult ? part.shop_rating : shopData?.rating,
      shop_review_count: isRpcResult ? 0 : shopData?.review_count || 0,
      shop_user_id: isRpcResult ? part.shop_user_id : shopData?.user_id,
    }
  }) || []

  return transformedParts
}

// Fetch function for category hierarchy - returns hardcoded values since the RPC function doesn't exist
async function fetchCategoryHierarchy(_supabase: ReturnType<typeof createClient>) {
  // The get_category_hierarchy RPC function doesn't exist in the database
  // Return hardcoded hierarchy directly
  return [
    { category: 'mobile_phones', subcategories: ['smartphones', 'feature_phones'] },
    { category: 'phone_parts', subcategories: ['screen', 'battery', 'charging_port', 'camera', 'speaker', 'microphone', 'housing', 'other'] },
    { category: 'phone_accessories', subcategories: ['charger', 'case', 'earphones', 'screen_protector', 'cable', 'other'] },
    { category: 'laptops', subcategories: ['gaming', 'business', 'ultrabook', 'workstation', 'chromebook', 'other'] },
    { category: 'steam_kits', subcategories: ['coding', 'robotics', 'ai', 'electronics', 'other'] },
    { category: 'other_electronics', subcategories: ['tv', 'audio', 'gaming', 'networking', 'power', 'other'] }
  ]
}

export function useParts(initialFilters?: Partial<PartsFilters>) {
  const queryClient = useQueryClient()
  const supabase = useMemo(() => createClient(), [])
  
  const [filters, setFilters] = useState<PartsFilters>({
    search: '',
    categories: [],
    subcategories: [],
    brands: [],
    models: [],
    conditions: [],
    priceRange: { min: null, max: null },
    location: '',
    sortBy: 'relevance',
    ficaVerifiedOnly: false,
    partTypes: [],
    ...initialFilters
  })

  // Query for parts with 2-minute stale time
  const {
    data: parts = [],
    isLoading: loading,
    error: queryError,
    refetch
  } = useQuery({
    queryKey: partsQueryKeys.list(filters),
    queryFn: () => fetchParts(supabase, filters),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes cache
  })

  // Query for category hierarchy with 5-minute stale time
  const { data: categoryHierarchy = [] } = useQuery({
    queryKey: partsQueryKeys.categories,
    queryFn: () => fetchCategoryHierarchy(supabase),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes cache
  })

  // Update filters
  const updateFilters = useCallback((newFilters: Partial<PartsFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }, [])

  // Get unique values for filter dropdowns
  const categories = useMemo(() => categoryHierarchy.map((h: CategoryHierarchy) => h.category), [categoryHierarchy])
  
  const conditions = useMemo(() => {
    return ['original', 'refurbished']
  }, [])

  // Refresh data
  const refresh = useCallback(() => {
    refetch()
  }, [refetch])

  // Convert error to string
  const error = queryError ? (queryError as Error).message : null

  return {
    parts,
    loading,
    error,
    totalCount: parts.length,
    filters,
    updateFilters,
    categories,
    conditions,
    categoryHierarchy,
    refresh
  }
}
