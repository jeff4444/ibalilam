"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Wallet,
  Lock,
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Filter,
  ArrowLeft,
  CreditCard,
  Banknote,
  History,
  ShieldCheck,
  Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MainNavbar } from "@/components/navbar"
import { useAuth } from "@/hooks/use-auth"
import { useWallet } from "@/hooks/use-wallet"
import { WalletDepositModal } from "@/components/wallet-deposit-modal"
import { WalletWithdrawModal } from "@/components/wallet-withdraw-modal"

const transactionTypeLabels: Record<string, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  escrow_hold: "Escrow Hold",
  escrow_release: "Escrow Release",
  sale_credit: "Sale Credit",
  commission_deduction: "Commission",
  refund: "Refund",
  adjustment: "Adjustment",
}

const transactionTypeColors: Record<string, string> = {
  deposit: "bg-emerald-100 text-emerald-800 border-emerald-200",
  withdrawal: "bg-red-100 text-red-800 border-red-200",
  escrow_hold: "bg-amber-100 text-amber-800 border-amber-200",
  escrow_release: "bg-emerald-100 text-emerald-800 border-emerald-200",
  sale_credit: "bg-blue-100 text-blue-800 border-blue-200",
  commission_deduction: "bg-gray-100 text-gray-800 border-gray-200",
  refund: "bg-purple-100 text-purple-800 border-purple-200",
  adjustment: "bg-slate-100 text-slate-800 border-slate-200",
}

const transactionTypeAmountColors: Record<string, string> = {
  deposit: "text-emerald-600",
  withdrawal: "text-red-600",
  escrow_hold: "text-amber-600",
  escrow_release: "text-emerald-600",
  sale_credit: "text-blue-600",
  commission_deduction: "text-gray-600",
  refund: "text-purple-600",
  adjustment: "text-slate-600",
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  failed: "bg-red-100 text-red-800 border-red-200",
  cancelled: "bg-gray-100 text-gray-800 border-gray-200",
}

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-4 w-4" />,
  completed: <CheckCircle className="h-4 w-4" />,
  failed: <XCircle className="h-4 w-4" />,
  cancelled: <XCircle className="h-4 w-4" />,
}

export default function WalletPage() {
  const [transactionFilter, setTransactionFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false)
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const { 
    wallet, 
    transactions, 
    pagination, 
    settings, 
    loading, 
    error, 
    refreshWallet, 
    fetchTransactions 
  } = useWallet()

  // Check for deposit/withdrawal success from URL params
  useEffect(() => {
    const deposit = searchParams.get('deposit')
    if (deposit === 'success') {
      setSuccessMessage('Deposit completed successfully! Your wallet balance has been updated.')
      // Remove the query param
      router.replace('/wallet')
    } else if (deposit === 'cancelled') {
      setSuccessMessage('Deposit was cancelled.')
      router.replace('/wallet')
    }
  }, [searchParams, router])

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  // Handle filter change
  const handleFilterChange = (value: string) => {
    setTransactionFilter(value)
    setCurrentPage(1)
    fetchTransactions(1, value)
  }

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    fetchTransactions(page, transactionFilter)
  }

  // Calculate transaction statistics
  const stats = useMemo(() => {
    const deposits = transactions.filter(t => t.type === 'deposit' && t.status === 'completed')
    const withdrawals = transactions.filter(t => t.type === 'withdrawal' && t.status === 'completed')
    const totalDeposits = deposits.reduce((sum, t) => sum + t.amount, 0)
    const totalWithdrawals = withdrawals.reduce((sum, t) => sum + Math.abs(t.amount), 0)
    
    return {
      totalDeposits,
      totalWithdrawals,
      depositCount: deposits.length,
      withdrawalCount: withdrawals.length
    }
  }, [transactions])

  // Show loading state
  if (authLoading || loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <MainNavbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading wallet...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex flex-col">
      <MainNavbar />

      <main className="flex-1 container mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {successMessage && (
          <Alert className="bg-emerald-50 border-emerald-200">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-emerald-800">{successMessage}</AlertDescription>
          </Alert>
        )}
        
        {/* Header */}
        <div className="mb-2 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Button asChild variant="ghost" size="sm" className="gap-1">
                <Link href="/dashboard">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Dashboard
                </Link>
              </Button>
            </div>
            <h2 className="text-3xl font-bold tracking-tight">My Wallet</h2>
            <p className="text-muted-foreground mt-1">
              Manage your funds, deposits, and withdrawals
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={refreshWallet}
              variant="outline"
              size="default"
              disabled={loading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Balance Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Total Balance Card */}
          <Card className="md:col-span-2 !bg-gradient-to-br !from-blue-600 !to-indigo-700 text-white !border-0 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium text-blue-100">Total Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-white mb-4">
                R {wallet?.totalBalance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </div>
              <div className="flex gap-4">
                <Button 
                  onClick={() => setIsDepositModalOpen(true)}
                  className="flex-1 bg-white/20 hover:bg-white/30 border-white/30 text-white"
                  variant="outline"
                >
                  <ArrowDownToLine className="mr-2 h-4 w-4" />
                  Deposit
                </Button>
                <Button 
                  onClick={() => setIsWithdrawModalOpen(true)}
                  className="flex-1 bg-white/20 hover:bg-white/30 border-white/30 text-white"
                  variant="outline"
                  disabled={!wallet?.availableBalance || wallet.availableBalance < (settings?.minWithdrawalAmount || 100)}
                >
                  <ArrowUpFromLine className="mr-2 h-4 w-4" />
                  Withdraw
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Available Balance */}
          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Available Balance
              </CardTitle>
              <CardAction>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                  <Wallet className="h-5 w-5 text-emerald-500" />
                </div>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-600">
                R {wallet?.availableBalance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </div>
              <p className="text-xs text-muted-foreground">
                Ready for withdrawal
              </p>
            </CardContent>
          </Card>

          {/* Locked Balance */}
          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Locked Balance
              </CardTitle>
              <CardAction>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                  <Lock className="h-5 w-5 text-amber-500" />
                </div>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">
                R {wallet?.lockedBalance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </div>
              <p className="text-xs text-muted-foreground">
                Held in escrow ({settings?.escrowAutoReleaseDays || 7} day release)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                  <TrendingUp className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Deposited</p>
                  <p className="text-xl font-bold">
                    R {wallet?.totalDeposited?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                  <TrendingDown className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Withdrawn</p>
                  <p className="text-xl font-bold">
                    R {wallet?.totalWithdrawn?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                  <CreditCard className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Min Withdrawal</p>
                  <p className="text-xl font-bold">
                    R {settings?.minWithdrawalAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '100.00'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
                  <ShieldCheck className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Max Withdrawal</p>
                  <p className="text-xl font-bold">
                    R {settings?.maxWithdrawalAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '50,000.00'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Transaction History
                </CardTitle>
                <CardDescription>View all your wallet transactions</CardDescription>
              </div>
              <Select value={transactionFilter} onValueChange={handleFilterChange}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Transactions</SelectItem>
                  <SelectItem value="deposit">Deposits</SelectItem>
                  <SelectItem value="withdrawal">Withdrawals</SelectItem>
                  <SelectItem value="escrow_hold">Escrow Hold</SelectItem>
                  <SelectItem value="escrow_release">Escrow Release</SelectItem>
                  <SelectItem value="refund">Refunds</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="text-center py-12">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                  <Banknote className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium">No transactions yet</h3>
                <p className="text-muted-foreground mt-1">
                  Your transaction history will appear here once you make deposits or receive payments.
                </p>
                <Button onClick={() => setIsDepositModalOpen(true)} className="mt-4">
                  <ArrowDownToLine className="mr-2 h-4 w-4" />
                  Make Your First Deposit
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        transaction.amount > 0 ? 'bg-emerald-100' : 'bg-red-100'
                      }`}>
                        {transaction.amount > 0 ? (
                          <ArrowDownToLine className={`h-5 w-5 text-emerald-600`} />
                        ) : (
                          <ArrowUpFromLine className={`h-5 w-5 text-red-600`} />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {transactionTypeLabels[transaction.type] || transaction.type}
                          </span>
                          <Badge 
                            variant="outline" 
                            className={transactionTypeColors[transaction.type]}
                          >
                            {transactionTypeLabels[transaction.type] || transaction.type}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {transaction.description || 'No description'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(transaction.createdAt).toLocaleDateString()} at{' '}
                          {new Date(transaction.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-semibold ${
                        transaction.amount > 0 ? transactionTypeAmountColors[transaction.type] : 'text-red-600'
                      }`}>
                        {transaction.amount > 0 ? '+' : ''}R {Math.abs(transaction.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <Badge 
                          variant="outline" 
                          className={`${statusColors[transaction.status]} text-xs`}
                        >
                          {statusIcons[transaction.status]}
                          <span className="ml-1">{transaction.status}</span>
                        </Badge>
                      </div>
                      {transaction.balanceAfter !== null && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Balance: R {transaction.balanceAfter.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {(currentPage - 1) * pagination.limit + 1} to{' '}
                      {Math.min(currentPage * pagination.limit, pagination.total)} of{' '}
                      {pagination.total} transactions
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage >= pagination.totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Section */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 flex-shrink-0">
                <Info className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium text-blue-800">How Wallet Escrow Works</h4>
                <ul className="mt-2 space-y-1 text-sm text-blue-700">
                  <li>• When you make a sale, funds are held in escrow (locked balance)</li>
                  <li>• Once the buyer confirms delivery, funds are released to your available balance</li>
                  <li>• Funds are automatically released after {settings?.escrowAutoReleaseDays || 7} days if no dispute is raised</li>
                  <li>• You can withdraw your available balance at any time (min R{settings?.minWithdrawalAmount || 100})</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Deposit Modal */}
      <WalletDepositModal
        open={isDepositModalOpen}
        onOpenChange={setIsDepositModalOpen}
      />

      {/* Withdraw Modal */}
      <WalletWithdrawModal
        open={isWithdrawModalOpen}
        onOpenChange={setIsWithdrawModalOpen}
        availableBalance={wallet?.availableBalance || 0}
        minAmount={settings?.minWithdrawalAmount || 100}
        maxAmount={settings?.maxWithdrawalAmount || 50000}
      />
    </div>
  )
}

