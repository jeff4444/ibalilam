'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { fetchWithCsrf } from '@/lib/csrf-client'
import { 
  Wallet, 
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Lock,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Send,
  Store
} from 'lucide-react'

interface WalletTransaction {
  id: string
  transaction_type: 'commission' | 'escrow_hold' | 'escrow_release' | 'payout' | 'refund' | 'adjustment'
  amount: number
  reference_id?: string
  reference_type?: string
  description?: string
  status: string
  payout_to_shop_id?: string
  payout_method?: string
  payout_reference?: string
  balance_after: number
  created_at: string
  shop_name?: string
}

interface ShopWithBalance {
  id: string
  name: string
  available_balance: number
  locked_balance: number
}

interface WalletData {
  availableBalance: number
  lockedBalance: number
  totalCommissions: number
  totalPayouts: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function AdminWalletPage() {
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [shopsWithBalance, setShopsWithBalance] = useState<ShopWithBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [showPayoutModal, setShowPayoutModal] = useState(false)
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false)
  const [selectedShop, setSelectedShop] = useState<ShopWithBalance | null>(null)
  const [payoutAmount, setPayoutAmount] = useState('')
  const [payoutMethod, setPayoutMethod] = useState('bank_transfer')
  const [payoutReference, setPayoutReference] = useState('')
  const [adjustmentAmount, setAdjustmentAmount] = useState('')
  const [adjustmentDescription, setAdjustmentDescription] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    fetchWalletData()
  }, [typeFilter, pagination.page])

  const fetchWalletData = async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      })
      
      if (typeFilter !== 'all') params.set('type', typeFilter)

      const response = await fetch(`/api/admin/wallet?${params}`)
      const data = await response.json()
      
      if (response.ok) {
        setWallet(data.wallet)
        setTransactions(data.transactions)
        setShopsWithBalance(data.shopsWithBalance)
        setPagination(prev => ({ ...prev, ...data.pagination }))
      }
    } catch (error) {
      console.error('Error fetching wallet data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePayout = async () => {
    if (!selectedShop || !payoutAmount) return

    try {
      setIsProcessing(true)

      const response = await fetchWithCsrf('/api/admin/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'payout',
          shop_id: selectedShop.id,
          amount: parseFloat(payoutAmount),
          method: payoutMethod,
          reference: payoutReference
        })
      })

      if (response.ok) {
        setShowPayoutModal(false)
        setSelectedShop(null)
        setPayoutAmount('')
        setPayoutReference('')
        fetchWalletData()
      }
    } catch (error) {
      console.error('Error processing payout:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleAdjustment = async () => {
    if (!adjustmentAmount || !adjustmentDescription) return

    try {
      setIsProcessing(true)

      const response = await fetchWithCsrf('/api/admin/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'adjustment',
          amount: parseFloat(adjustmentAmount),
          description: adjustmentDescription
        })
      })

      if (response.ok) {
        setShowAdjustmentModal(false)
        setAdjustmentAmount('')
        setAdjustmentDescription('')
        fetchWalletData()
      }
    } catch (error) {
      console.error('Error processing adjustment:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  const getTransactionIcon = (type: string, amount: number) => {
    if (amount >= 0) {
      return <ArrowUpRight className="h-4 w-4 text-emerald-400" />
    }
    return <ArrowDownRight className="h-4 w-4 text-red-400" />
  }

  const getTransactionBadge = (type: string) => {
    switch (type) {
      case 'commission':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Commission</Badge>
      case 'payout':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Payout</Badge>
      case 'escrow_hold':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Escrow Hold</Badge>
      case 'escrow_release':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Escrow Release</Badge>
      case 'refund':
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">Refund</Badge>
      case 'adjustment':
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Adjustment</Badge>
      default:
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">{type}</Badge>
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Admin Wallet</h1>
          <p className="text-slate-400 mt-1">Manage platform finances, commissions, and payouts</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAdjustmentModal(true)} variant="outline" className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700 hover:border-slate-500 hover:text-white">
            <Plus className="mr-2 h-4 w-4" />
            Adjustment
          </Button>
          <Button onClick={fetchWalletData} variant="outline" className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700 hover:border-slate-500 hover:text-white">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Wallet Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <DollarSign className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold text-white">{formatCurrency(wallet?.availableBalance || 0)}</p>
                <p className="text-sm text-slate-400">Available Balance</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Lock className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold text-white">{formatCurrency(wallet?.lockedBalance || 0)}</p>
                <p className="text-sm text-slate-400">Locked (Escrow)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <TrendingUp className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold text-white">{formatCurrency(wallet?.totalCommissions || 0)}</p>
                <p className="text-sm text-slate-400">Total Commissions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <TrendingDown className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold text-white">{formatCurrency(wallet?.totalPayouts || 0)}</p>
                <p className="text-sm text-slate-400">Total Payouts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Shops with Balance (Payout Queue) */}
      {shopsWithBalance.length > 0 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Store className="h-5 w-5 text-emerald-500" />
              Shops Ready for Payout
            </CardTitle>
            <CardDescription className="text-slate-400">Shops with available balance for withdrawal</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {shopsWithBalance.map((shop) => (
                <Card key={shop.id} className="bg-slate-800 border-slate-700">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-white">{shop.name}</h4>
                      <Button
                        size="sm"
                        onClick={() => { setSelectedShop(shop); setPayoutAmount(shop.available_balance.toString()); setShowPayoutModal(true) }}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Send className="h-4 w-4 mr-1" />
                        Payout
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-slate-400">Available</p>
                        <p className="text-emerald-400 font-semibold">{formatCurrency(shop.available_balance)}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Locked</p>
                        <p className="text-yellow-400 font-semibold">{formatCurrency(shop.locked_balance)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction Filter */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-48 bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Transaction Type" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="commission">Commissions</SelectItem>
                <SelectItem value="payout">Payouts</SelectItem>
                <SelectItem value="escrow_hold">Escrow Holds</SelectItem>
                <SelectItem value="escrow_release">Escrow Releases</SelectItem>
                <SelectItem value="refund">Refunds</SelectItem>
                <SelectItem value="adjustment">Adjustments</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Transaction History</CardTitle>
          <CardDescription className="text-slate-400">Platform wallet transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8">
              <Wallet className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No transactions found</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400">Type</TableHead>
                    <TableHead className="text-slate-400">Description</TableHead>
                    <TableHead className="text-slate-400">Amount</TableHead>
                    <TableHead className="text-slate-400">Balance After</TableHead>
                    <TableHead className="text-slate-400">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id} className="border-slate-800 hover:bg-slate-800/50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTransactionIcon(tx.transaction_type, tx.amount)}
                          {getTransactionBadge(tx.transaction_type)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-white">{tx.description || '-'}</p>
                          {tx.shop_name && (
                            <p className="text-sm text-slate-500">Shop: {tx.shop_name}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className={tx.amount >= 0 ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                        {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                      </TableCell>
                      <TableCell className="text-slate-300">{formatCurrency(tx.balance_after)}</TableCell>
                      <TableCell className="text-slate-400">
                        {new Date(tx.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-slate-400">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-slate-400">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page === pagination.totalPages}
                    className="border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Payout Modal */}
      <Dialog open={showPayoutModal} onOpenChange={setShowPayoutModal}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>Process Payout</DialogTitle>
            <DialogDescription className="text-slate-400">
              Send funds to {selectedShop?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedShop && (
            <div className="space-y-4">
              <div>
                <Label className="text-slate-400">Available Balance</Label>
                <p className="text-emerald-400 text-xl font-semibold">{formatCurrency(selectedShop.available_balance)}</p>
              </div>

              <div>
                <Label htmlFor="payout-amount" className="text-slate-400">Amount to Payout</Label>
                <Input
                  id="payout-amount"
                  type="number"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  placeholder="0.00"
                  max={selectedShop.available_balance}
                  className="bg-slate-800 border-slate-700 text-white mt-1"
                />
              </div>

              <div>
                <Label htmlFor="payout-method" className="text-slate-400">Payment Method</Label>
                <Select value={payoutMethod} onValueChange={setPayoutMethod}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="ewallet">E-Wallet</SelectItem>
                    <SelectItem value="payfast">PayFast</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="payout-reference" className="text-slate-400">Reference (optional)</Label>
                <Input
                  id="payout-reference"
                  value={payoutReference}
                  onChange={(e) => setPayoutReference(e.target.value)}
                  placeholder="Transaction reference..."
                  className="bg-slate-800 border-slate-700 text-white mt-1"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowPayoutModal(false)} className="border-slate-700 text-slate-300">
                  Cancel
                </Button>
                <Button
                  onClick={handlePayout}
                  disabled={isProcessing || !payoutAmount || parseFloat(payoutAmount) <= 0 || parseFloat(payoutAmount) > selectedShop.available_balance}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {isProcessing ? 'Processing...' : `Payout ${formatCurrency(parseFloat(payoutAmount) || 0)}`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Adjustment Modal */}
      <Dialog open={showAdjustmentModal} onOpenChange={setShowAdjustmentModal}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>Balance Adjustment</DialogTitle>
            <DialogDescription className="text-slate-400">
              Add or subtract from the platform balance
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="adjustment-amount" className="text-slate-400">Amount (positive to add, negative to subtract)</Label>
              <Input
                id="adjustment-amount"
                type="number"
                value={adjustmentAmount}
                onChange={(e) => setAdjustmentAmount(e.target.value)}
                placeholder="0.00"
                className="bg-slate-800 border-slate-700 text-white mt-1"
              />
            </div>

            <div>
              <Label htmlFor="adjustment-description" className="text-slate-400">Description (required)</Label>
              <Textarea
                id="adjustment-description"
                value={adjustmentDescription}
                onChange={(e) => setAdjustmentDescription(e.target.value)}
                placeholder="Reason for adjustment..."
                className="bg-slate-800 border-slate-700 text-white mt-1"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAdjustmentModal(false)} className="border-slate-700 text-slate-300">
                Cancel
              </Button>
              <Button
                onClick={handleAdjustment}
                disabled={isProcessing || !adjustmentAmount || !adjustmentDescription}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isProcessing ? 'Processing...' : 'Apply Adjustment'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

