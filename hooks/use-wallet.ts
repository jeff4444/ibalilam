import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'

interface Wallet {
  id: string
  availableBalance: number
  lockedBalance: number
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

export function useWallet(): UseWalletReturn {
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [settings, setSettings] = useState<WalletSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const fetchWallet = useCallback(async (page: number = 1, type: string = '') => {
    try {
      setLoading(true)
      setError(null)

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

      setWallet(data.wallet)
      setTransactions(data.transactions)
      setPagination(data.pagination)
      setSettings(data.settings)
    } catch (err: any) {
      console.error('Error fetching wallet:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshWallet = useCallback(async () => {
    await fetchWallet()
  }, [fetchWallet])

  const fetchTransactions = useCallback(async (page: number = 1, type: string = '') => {
    await fetchWallet(page, type)
  }, [fetchWallet])

  const initiateDeposit = useCallback(async (amount: number) => {
    try {
      const response = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate deposit')
      }

      return {
        payfastUrl: data.payfastUrl,
        payfastData: data.payfastData
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, bankDetails })
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to process withdrawal' }
      }

      // Refresh wallet data after withdrawal
      await refreshWallet()

      return { success: true, message: data.message }
    } catch (err: any) {
      console.error('Error initiating withdrawal:', err)
      return { success: false, error: err.message }
    }
  }, [refreshWallet])

  // Initial fetch
  useEffect(() => {
    fetchWallet()
  }, [fetchWallet])

  // Subscribe to real-time updates
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
            refreshWallet()
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
            refreshWallet()
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }

    setupSubscription()
  }, [supabase, refreshWallet])

  return {
    wallet,
    transactions,
    pagination,
    settings,
    loading,
    error,
    refreshWallet,
    fetchTransactions,
    initiateDeposit,
    initiateWithdrawal
  }
}

