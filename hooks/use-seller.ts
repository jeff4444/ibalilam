import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export interface SellerData {
  id: string
  userId: string
  name: string
  firstName?: string
  lastName?: string
  avatar?: string
  rating: number
  totalReviews: number
  joinDate: string
  location?: string
  responseTime: string
  verified: boolean
  bio?: string
  specializations?: string[]
  stats: {
    totalSales: number
    completionRate: number
    repeatCustomers: number
    activeListings: number
    conversionRate: number
    customerSatisfaction: number
  }
}

export function useSeller(sellerId: string) {
  const [seller, setSeller] = useState<SellerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const fetchSellerData = async () => {
      try {
        setLoading(true)
        setError(null)

        // First, fetch shop data using the shop_id
        const { data: shopData, error: shopError } = await supabase
          .from('shops')
          .select('*')
          .eq('id', sellerId)
          .eq('is_active', true)
          .single()

        if (shopError) {
          throw shopError
        }

        if (!shopData) {
          throw new Error('Shop not found')
        }

        // Then, fetch the user profile of the shop owner
        const { data: userProfileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', shopData.user_id)
          .single()

        if (profileError) {
          // Profile might not exist, but that's okay - we'll use shop data
          console.warn('Could not fetch user profile:', profileError)
        }

        // Fetch reviews for this shop
        const { data: reviewsData, error: reviewsError } = await supabase
          .from('reviews')
          .select('rating, status')
          .eq('shop_id', shopData.id)
          .eq('status', 'approved')

        if (reviewsError) {
          console.warn('Could not fetch reviews:', reviewsError)
        }

        // Calculate review stats
        const reviews = reviewsData || []
        const totalReviews = reviews.length
        const averageRating = totalReviews > 0 
          ? reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews 
          : 0

        // Format join date - use profile created_at if available, otherwise shop created_at
        const joinDate = new Date(userProfileData?.created_at || shopData.created_at)
          .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

        // Format response time
        const avgResponseTimeHours = shopData.avg_response_time_hours || 0
        const responseTime = avgResponseTimeHours < 1 
          ? '< 1 hour' 
          : avgResponseTimeHours < 24 
            ? `< ${Math.ceil(avgResponseTimeHours)} hours`
            : `< ${Math.ceil(avgResponseTimeHours / 24)} days`

        // Construct seller data
        const sellerData: SellerData = {
          id: shopData.id,
          userId: shopData.user_id,
          name: shopData.name,
          firstName: userProfileData?.first_name,
          lastName: userProfileData?.last_name,
          avatar: undefined, // Will need to be added to user_profiles table or use external service
          rating: Math.round(averageRating * 10) / 10, // Round to 1 decimal place
          totalReviews,
          joinDate,
          location: userProfileData?.location,
          responseTime,
          verified: true, // Could be determined by business logic
          bio: userProfileData?.bio || shopData.description,
          specializations: userProfileData?.specializations || [],
          stats: {
            totalSales: Math.floor(shopData.total_sales || 0),
            completionRate: shopData.customer_satisfaction || 0,
            repeatCustomers: shopData.repeat_customer_rate || 0,
            activeListings: shopData.active_listings || 0,
            conversionRate: shopData.conversion_rate || 0,
            customerSatisfaction: shopData.customer_satisfaction || 0,
          }
        }

        setSeller(sellerData)
      } catch (err) {
        console.error('Error fetching seller data:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch seller data')
      } finally {
        setLoading(false)
      }
    }

    if (sellerId) {
      fetchSellerData()
    }
  }, [sellerId, supabase])

  return { seller, loading, error }
}
