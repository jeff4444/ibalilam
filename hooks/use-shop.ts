import { useMemo, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
  locked_balance: number
  available_balance: number
  pending_withdrawal_balance: number
  // Wallet balances (from user_wallets table)
  wallet_available_balance: number
  wallet_locked_balance: number
  wallet_pending_withdrawal_balance: number
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
  images: string[] | null
  views: number
  created_at: string
  updated_at: string
  published_at: string | null
  // MOQ and pricing fields
  moq: number | null
  moq_units: number | null
  order_increment: number | null
  pack_size_units: number | null
  stock_on_hand_units: number | null
  backorder_allowed: boolean | null
  lead_time_days: number | null
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

interface ShopData {
  shopStats: ShopStats | null
  originalParts: Part[]
  refurbishedParts: Part[]
  recentOrders: Order[]
}

// Query keys for cache management
export const shopQueryKeys = {
  all: ['shop'] as const,
  data: (userId: string) => ['shop', 'data', userId] as const,
}

// Fetch function for shop data
async function fetchShopData(supabase: ReturnType<typeof createClient>, userId: string): Promise<ShopData> {
  // Get user's shop
  const { data: shop, error: shopError } = await supabase
    .from('shops')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (shopError) {
    // If shop doesn't exist, create a default one
    if (shopError.code === 'PGRST116') {
      const { data: newShop, error: createError } = await supabase
        .from('shops')
        .insert({
          user_id: userId,
          name: 'My Shop',
          description: 'Welcome to my electronics shop!',
        })
        .select()
        .single()

      if (createError) {
        throw new Error(`Failed to create shop: ${createError.message}`)
      }
      
      // Return defaults for newly created shop
      return {
        shopStats: {
          name: newShop.name || 'My Shop',
          description: newShop.description || 'Welcome to my electronics shop!',
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
          locked_balance: 0,
          available_balance: 0,
          pending_withdrawal_balance: 0,
          wallet_available_balance: 0,
          wallet_locked_balance: 0,
          wallet_pending_withdrawal_balance: 0,
        },
        originalParts: [],
        refurbishedParts: [],
        recentOrders: [],
      }
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

  // Get user wallet data
  let walletAvailableBalance = 0
  let walletLockedBalance = 0
  let walletPendingWithdrawalBalance = 0
  const { data: wallet } = await supabase
    .from('user_wallets')
    .select('available_balance, locked_balance, pending_withdrawal_balance')
    .eq('user_id', userId)
    .single()

  if (wallet) {
    walletAvailableBalance = parseFloat(wallet.available_balance?.toString() || '0')
    walletLockedBalance = parseFloat(wallet.locked_balance?.toString() || '0')
    walletPendingWithdrawalBalance = parseFloat(wallet.pending_withdrawal_balance?.toString() || '0')
  }

  // Set shop stats from shop data
  const shopStats: ShopStats = {
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
    locked_balance: shop.locked_balance || 0,
    available_balance: shop.available_balance || 0,
    pending_withdrawal_balance: shop.pending_withdrawal_balance || 0,
    wallet_available_balance: walletAvailableBalance,
    wallet_locked_balance: walletLockedBalance,
    wallet_pending_withdrawal_balance: walletPendingWithdrawalBalance,
  }

  // Get original parts
  let originalParts: Part[] = []
  const { data: original, error: originalError } = await supabase
    .from('parts')
    .select('*')
    .eq('shop_id', shop.id)
    .eq('part_type', 'original')
    .order('created_at', { ascending: false })

  if (originalError && originalError.code !== 'PGRST106') {
    throw new Error(`Failed to fetch original parts: ${originalError.message}`)
  } else {
    originalParts = original || []
  }

  // Get refurbished parts
  let refurbishedParts: Part[] = []
  const { data: refurbished, error: refurbishedError } = await supabase
    .from('parts')
    .select('*')
    .eq('shop_id', shop.id)
    .eq('part_type', 'refurbished')
    .order('created_at', { ascending: false })

  if (refurbishedError && refurbishedError.code !== 'PGRST106') {
    throw new Error(`Failed to fetch refurbished parts: ${refurbishedError.message}`)
  } else {
    refurbishedParts = refurbished || []
  }

  // Get recent orders directly from orders table
  let recentOrders: Order[] = []
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

  if (!ordersError) {
    // Transform the data to match our interface
    recentOrders = orders?.map(order => ({
      order_id: order.id,
      order_number: order.order_number,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      product_name: (order.order_items as any)?.[0]?.parts?.name || 'Multiple items',
      amount: order.total_amount,
      status: order.status,
      created_at: order.created_at,
    })) || []
  }

  return {
    shopStats,
    originalParts,
    refurbishedParts,
    recentOrders,
  }
}

export function useShop() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const supabase = useMemo(() => createClient(), [])

  // Query for shop data with 1-minute stale time
  const {
    data,
    isLoading: loading,
    isFetching: refreshing,
    error: queryError,
    refetch
  } = useQuery({
    queryKey: shopQueryKeys.data(user?.id || ''),
    queryFn: () => fetchShopData(supabase, user!.id),
    enabled: !!user?.id,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes cache
  })

  const refreshData = useCallback(() => {
    refetch()
  }, [refetch])

  // Convert error to string
  const error = queryError ? (queryError as Error).message : null

  return {
    shopStats: data?.shopStats || null,
    originalParts: data?.originalParts || [],
    refurbishedParts: data?.refurbishedParts || [],
    recentOrders: data?.recentOrders || [],
    loading,
    refreshing: refreshing && !loading,
    error,
    refreshData
  }
}
