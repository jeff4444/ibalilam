import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import { getCsrfHeaders } from '@/lib/csrf-client'

interface Wallet {
  id: string
  availableBalance: number
  lockedBalance: number
  pendingWithdrawalBalance: number
  totalBalance: number
  totalDeposited: number
  totalWithdrawn: number
  createdAt: string
  updatedAt: string
}

interface WalletTransaction {
  id: string
  type: string
  amount: number
  status: string
  referenceId: string | null
  referenceType: string | null
  description: string | null
  balanceAfter: number
  payfastPaymentId: string | null
  createdAt: string
}

interface WalletSettings {
  minWithdrawalAmount: number
  maxWithdrawalAmount: number
  escrowAutoReleaseDays: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface WalletData {
  wallet: Wallet | null
  transactions: WalletTransaction[]
  pagination: Pagination | null
  settings: WalletSettings | null
}

interface UseWalletReturn {
  wallet: Wallet | null
  transactions: WalletTransaction[]
  pagination: Pagination | null
  settings: WalletSettings | null
  loading: boolean
  error: string | null
  refreshWallet: () => Promise<void>
  fetchTransactions: (page?: number, type?: string) => Promise<void>
  initiateDeposit: (amount: number) => Promise<{ payfastUrl: string; payfastData: Record<string, string> } | null>
  initiateWithdrawal: (amount: number, bankDetails?: any) => Promise<{ success: boolean; message?: string; error?: string }>
}

// Query keys for cache management
export const walletQueryKeys = {
  all: ['wallet'] as const,
  data: (page: number, type: string) => ['wallet', 'data', page, type] as const,
}

// Fetch function for wallet data
async function fetchWalletData(page: number = 1, type: string = ''): Promise<WalletData> {
  const params = new URLSearchParams()
  params.set('page', page.toString())
  if (type && type !== 'all') {
    params.set('type', type)
  }

  const response = await fetch(`/api/wallet?${params.toString()}`)
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch wallet')
  }

  return {
    wallet: data.wallet,
    transactions: data.transactions,
    pagination: data.pagination,
    settings: data.settings,
  }
}

export function useWallet(): UseWalletReturn {
  const queryClient = useQueryClient()
  const supabase = useMemo(() => createClient(), [])
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [currentType, setCurrentType] = useState('')

  // Query for wallet data with 30-second stale time
  const {
    data,
    isLoading: loading,
    refetch
  } = useQuery({
    queryKey: walletQueryKeys.data(currentPage, currentType),
    queryFn: () => fetchWalletData(currentPage, currentType),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes cache
  })

  const refreshWallet = useCallback(async () => {
    setError(null)
    await refetch()
  }, [refetch])

  const fetchTransactions = useCallback(async (page: number = 1, type: string = '') => {
    setCurrentPage(page)
    setCurrentType(type)
    // The query will automatically refetch due to queryKey change
  }, [])

  const initiateDeposit = useCallback(async (amount: number) => {
    try {
      const response = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getCsrfHeaders(),
        },
        body: JSON.stringify({ amount })
      })

      const responseData = await response.json()

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to initiate deposit')
      }

      return {
        payfastUrl: responseData.payfastUrl,
        payfastData: responseData.payfastData
      }
    } catch (err: any) {
      console.error('Error initiating deposit:', err)
      setError(err.message)
      return null
    }
  }, [])

  const initiateWithdrawal = useCallback(async (amount: number, bankDetails?: any) => {
    try {
      const response = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getCsrfHeaders(),
        },
        body: JSON.stringify({ amount, bankDetails })
      })

      const responseData = await response.json()

      if (!response.ok) {
        return { success: false, error: responseData.error || 'Failed to process withdrawal' }
      }

      // Invalidate wallet cache after withdrawal
      queryClient.invalidateQueries({ queryKey: walletQueryKeys.all })

      return { success: true, message: responseData.message }
    } catch (err: any) {
      console.error('Error initiating withdrawal:', err)
      return { success: false, error: err.message }
    }
  }, [queryClient])

  // Subscribe to real-time updates and invalidate cache
  useEffect(() => {
    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const channel = supabase
        .channel('wallet-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_wallets',
            filter: `user_id=eq.${user.id}`
          },
          () => {
            // Invalidate cache on wallet updates
            queryClient.invalidateQueries({ queryKey: walletQueryKeys.all })
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'wallet_transactions'
          },
          () => {
            // Invalidate cache on new transactions
            queryClient.invalidateQueries({ queryKey: walletQueryKeys.all })
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }

    setupSubscription()
  }, [supabase, queryClient])

  return {
    wallet: data?.wallet || null,
    transactions: data?.transactions || [],
    pagination: data?.pagination || null,
    settings: data?.settings || null,
    loading,
    error,
    refreshWallet,
    fetchTransactions,
    initiateDeposit,
    initiateWithdrawal
  }
}
