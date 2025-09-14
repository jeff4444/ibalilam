import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from './use-auth'

export interface ShopStats {
  name: string
  description: string
  total_sales: number
  active_listings: number
  total_views: number
  refurbished_sold: number
  rating: number
  review_count: number
  conversion_rate: number
  avg_response_time_hours: number
  customer_satisfaction: number
  repeat_customer_rate: number
}

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
}

export interface Order {
  order_id: string
  order_number: string
  customer_name: string | null
  customer_email: string | null
  product_name: string | null
  amount: number
  status: string
  created_at: string
}

export function useShop() {
  const [shopStats, setShopStats] = useState<ShopStats | null>(null)
  const [originalParts, setOriginalParts] = useState<Part[]>([])
  const [refurbishedParts, setRefurbishedParts] = useState<Part[]>([])
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [initialLoad, setInitialLoad] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { user } = useAuth()
  const supabase = useMemo(() => createClient(), [])

  const fetchShopData = useCallback(async (isRefresh = false) => {
    if (!user) return

    try {
      // Only show loading spinner on initial load, not on refreshes
      if (initialLoad) {
        setLoading(true)
      } else if (isRefresh) {
        setRefreshing(true)
      }
      setError(null)

      // Get user's shop
      const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (shopError) {
        console.error('Shop query error:', shopError)
        // If shop doesn't exist, create a default one
        if (shopError.code === 'PGRST116') {
          console.log('No shop found, creating default shop...')
          const { data: newShop, error: createError } = await supabase
            .from('shops')
            .insert({
              user_id: user.id,
              name: 'My Shop',
              description: 'Welcome to my electronics shop!',
            })
            .select()
            .single()

          if (createError) {
            throw new Error(`Failed to create shop: ${createError.message}`)
          }
          
          // Use the newly created shop
          const defaultShop = newShop
          setShopStats({
            name: defaultShop.name || 'My Shop',
            description: defaultShop.description || 'Welcome to my electronics shop!',
            total_sales: 0,
            active_listings: 0,
            total_views: 0,
            refurbished_sold: 0,
            rating: 0,
            review_count: 0,
            conversion_rate: 0,
            avg_response_time_hours: 0,
            customer_satisfaction: 0,
            repeat_customer_rate: 0,
          })
          setOriginalParts([])
          setRefurbishedParts([])
          setRecentOrders([])
          return
        } else {
          throw new Error(`Failed to fetch shop: ${shopError.message}`)
        }
      }

      if (!shop) {
        throw new Error('No shop found for user')
      }

      // Get refurbished parts count for stats
      const { count: refurbishedSoldCount } = await supabase
        .from('parts')
        .select('*', { count: 'exact', head: true })
        .eq('shop_id', shop.id)
        .eq('part_type', 'refurbished')
        .eq('status', 'sold')

      // Set shop stats from shop data
      setShopStats({
        name: shop.name || 'My Shop',
        description: shop.description || 'Welcome to my electronics shop!',
        total_sales: shop.total_sales || 0,
        active_listings: shop.active_listings || 0,
        total_views: shop.total_views || 0,
        refurbished_sold: refurbishedSoldCount || 0,
        rating: shop.rating || 0,
        review_count: shop.review_count || 0,
        conversion_rate: shop.conversion_rate || 0,
        avg_response_time_hours: shop.avg_response_time_hours || 0,
        customer_satisfaction: shop.customer_satisfaction || 0,
        repeat_customer_rate: shop.repeat_customer_rate || 0,
      })

      // Get original parts
      const { data: original, error: originalError } = await supabase
        .from('parts')
        .select('*')
        .eq('shop_id', shop.id)
        .eq('part_type', 'original')
        .order('created_at', { ascending: false })

      if (originalError) {
        console.error('Original parts query error:', originalError)
        // If parts table doesn't exist, just set empty array
        if (originalError.code === 'PGRST106') {
          console.log('Parts table does not exist yet')
          setOriginalParts([])
        } else {
          throw new Error(`Failed to fetch original parts: ${originalError.message}`)
        }
      } else {
        setOriginalParts(original || [])
      }

      // Get refurbished parts
      const { data: refurbished, error: refurbishedError } = await supabase
        .from('parts')
        .select('*')
        .eq('shop_id', shop.id)
        .eq('part_type', 'refurbished')
        .order('created_at', { ascending: false })

      if (refurbishedError) {
        console.error('Refurbished parts query error:', refurbishedError)
        // If parts table doesn't exist, just set empty array
        if (refurbishedError.code === 'PGRST106') {
          console.log('Parts table does not exist yet')
          setRefurbishedParts([])
        } else {
          throw new Error(`Failed to fetch refurbished parts: ${refurbishedError.message}`)
        }
      } else {
        setRefurbishedParts(refurbished || [])
      }

      // Get recent orders directly from orders table
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          customer_name,
          customer_email,
          total_amount,
          status,
          created_at,
          order_items (
            part_id,
            total_price,
            parts (
              name
            )
          )
        `)
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (ordersError) {
        console.error('Orders error:', ordersError)
        // If orders table doesn't exist, just set empty array
        if (ordersError.code === 'PGRST106') {
          console.log('Orders table does not exist yet')
          setRecentOrders([])
        } else {
          setRecentOrders([])
        }
      } else {
        // Transform the data to match our interface
        const transformedOrders = orders?.map(order => ({
          order_id: order.id,
          order_number: order.order_number,
          customer_name: order.customer_name,
          customer_email: order.customer_email,
          product_name: (order.order_items as any)?.[0]?.parts?.name || 'Multiple items',
          amount: order.total_amount,
          status: order.status,
          created_at: order.created_at,
        })) || []
        
        setRecentOrders(transformedOrders)
      }

    } catch (err: any) {
      console.error('Error fetching shop data:', err)
      const errorMessage = err?.message || err?.error?.message || 'Failed to fetch shop data'
      setError(errorMessage)
    } finally {
      setLoading(false)
      setRefreshing(false)
      setInitialLoad(false)
    }
  }, [user, supabase, initialLoad])

  useEffect(() => {
    if (user?.id) {
      fetchShopData()
    }
  }, [user?.id, fetchShopData])

  const refreshData = () => {
    fetchShopData(true) // Pass true to indicate this is a refresh
  }

  return {
    shopStats,
    originalParts,
    refurbishedParts,
    recentOrders,
    loading,
    refreshing,
    error,
    refreshData
  }
}
