import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'

export interface Part {
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
  shop_rating?: number
  shop_review_count?: number
}

export interface PartsFilters {
  search: string
  categories: string[]
  partTypes: string[]
  conditions: string[]
  priceRange: {
    min: number | null
    max: number | null
  }
  sortBy: 'relevance' | 'price-low' | 'price-high' | 'rating' | 'newest'
}

export function useParts(initialFilters?: Partial<PartsFilters>) {
  const [parts, setParts] = useState<Part[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  
  const [filters, setFilters] = useState<PartsFilters>({
    search: '',
    categories: [],
    partTypes: [],
    conditions: [],
    priceRange: { min: null, max: null },
    sortBy: 'relevance',
    ...initialFilters
  })

  const supabase = useMemo(() => createClient(), [])

  const fetchParts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Build the query
      let query = supabase
        .from('parts')
        .select(`
          *,
          shops!inner(
            name,
            rating,
            review_count
          )
        `)
        .eq('status', 'active') // Only show active parts

      // Apply search filter
      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%,search_keywords.cs.{${filters.search}}`)
      }

      // Apply category filter
      if (filters.categories.length > 0) {
        query = query.in('category', filters.categories)
      }

      // Apply part type filter
      if (filters.partTypes.length > 0) {
        query = query.in('part_type', filters.partTypes)
      }

      // Apply condition filter (for refurbished parts)
      if (filters.conditions.length > 0) {
        query = query.or(filters.conditions.map(condition => 
          condition === 'refurbished' 
            ? 'part_type.eq.refurbished' 
            : `refurbished_condition.eq.${condition}`
        ).join(','))
      }

      // Apply price range filter
      if (filters.priceRange.min !== null) {
        query = query.gte('price', filters.priceRange.min)
      }
      if (filters.priceRange.max !== null) {
        query = query.lte('price', filters.priceRange.max)
      }

      // Apply sorting
      switch (filters.sortBy) {
        case 'price-low':
          query = query.order('price', { ascending: true })
          break
        case 'price-high':
          query = query.order('price', { ascending: false })
          break
        case 'rating':
          query = query.order('shops(rating)', { ascending: false })
          break
        case 'newest':
          query = query.order('created_at', { ascending: false })
          break
        case 'relevance':
        default:
          // For relevance, we'll order by views and created_at
          query = query.order('views', { ascending: false }).order('created_at', { ascending: false })
          break
      }

      // Get total count for pagination
      const { count } = await supabase
        .from('parts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')

      setTotalCount(count || 0)

      // Execute the main query
      const { data, error: queryError } = await query

      if (queryError) {
        throw new Error(`Failed to fetch parts: ${queryError.message}`)
      }

      // Transform the data to include shop information
      const transformedParts = data?.map(part => ({
        ...part,
        shop_name: (part.shops as any)?.name,
        shop_rating: (part.shops as any)?.rating,
        shop_review_count: (part.shops as any)?.review_count,
      })) || []

      setParts(transformedParts)

    } catch (err: any) {
      console.error('Error fetching parts:', err)
      setError(err.message || 'Failed to fetch parts')
    } finally {
      setLoading(false)
    }
  }, [filters, supabase])

  // Fetch parts when filters change
  useEffect(() => {
    fetchParts()
  }, [fetchParts])

  // Update filters
  const updateFilters = useCallback((newFilters: Partial<PartsFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }, [])

  // Get unique categories from parts
  const categories = useMemo(() => {
    const uniqueCategories = [...new Set(parts.map(part => part.category))]
    return uniqueCategories.sort()
  }, [parts])

  // Get unique conditions from parts
  const conditions = useMemo(() => {
    const uniqueConditions = new Set<string>()
    parts.forEach(part => {
      if (part.part_type === 'refurbished' && part.refurbished_condition) {
        uniqueConditions.add(part.refurbished_condition)
      }
    })
    return Array.from(uniqueConditions).sort()
  }, [parts])

  return {
    parts,
    loading,
    error,
    totalCount,
    filters,
    updateFilters,
    categories,
    conditions,
    refresh: fetchParts
  }
}
