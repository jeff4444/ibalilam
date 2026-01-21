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
  CreditCard, 
  Search, 
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lock,
  Unlock,
  DollarSign
} from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

interface Transaction {
  id: string
  order_id: string
  amount: number
  commission_amount: number
  seller_amount: number
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'disputed'
  payment_method?: string
  payment_intent_id?: string
  escrow_status: 'held' | 'released' | 'refunded' | 'disputed'
  escrow_hold_until?: string
  created_at: string
  updated_at: string
  completed_at?: string
  refunded_at?: string
  refund_reason?: string
  dispute_reason?: string
  admin_notes?: string
  order_number?: string
  customer_name?: string
  customer_email?: string
  shop_name: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [escrowFilter, setEscrowFilter] = useState('all')
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showActionModal, setShowActionModal] = useState(false)
  const [actionType, setActionType] = useState<'release' | 'refund' | 'dispute'>('release')
  const [actionReason, setActionReason] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [statsCounts, setStatsCounts] = useState({ totalAmount: 0, totalCommissions: 0, pendingEscrow: 0, completedCount: 0 })

  useEffect(() => {
    fetchStatsCounts()
  }, [])

  useEffect(() => {
    fetchTransactions()
  }, [searchTerm, statusFilter, escrowFilter, pagination.page])

  const fetchStatsCounts = async () => {
    try {
      const response = await fetch('/api/admin/transactions?limit=1000')
      const data = await response.json()
      
      if (response.ok && data.transactions) {
        const allTransactions = data.transactions as Transaction[]
        setStatsCounts({
          totalAmount: allTransactions.reduce((sum, t) => sum + t.amount, 0),
          totalCommissions: allTransactions.reduce((sum, t) => sum + t.commission_amount, 0),
          pendingEscrow: allTransactions.filter(t => t.escrow_status === 'held').reduce((sum, t) => sum + t.seller_amount, 0),
          completedCount: allTransactions.filter(t => t.status === 'completed').length
        })
      }
    } catch (error) {
      console.error('Error fetching stats counts:', error)
    }
  }

  const fetchTransactions = async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      })
      
      if (searchTerm) params.set('search', searchTerm)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (escrowFilter !== 'all') params.set('escrow_status', escrowFilter)

      const response = await fetch(`/api/admin/transactions?${params}`)
      const data = await response.json()
      
      if (response.ok) {
        setTransactions(data.transactions)
        setPagination(prev => ({ ...prev, ...data.pagination }))
      }
    } catch (error) {
      console.error('Error fetching transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async () => {
    if (!selectedTransaction) return

    try {
      setIsProcessing(true)

      const response = await fetchWithCsrf('/api/admin/transactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: selectedTransaction.id,
          action: actionType === 'release' ? 'release_escrow' : actionType,
          reason: actionReason
        })
      })

      if (response.ok) {
        setShowActionModal(false)
        setSelectedTransaction(null)
        setActionReason('')
        fetchTransactions()
        fetchStatsCounts()
      }
    } catch (error) {
      console.error('Error processing action:', error)
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pending</Badge>
      case 'processing':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Processing</Badge>
      case 'completed':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Completed</Badge>
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Failed</Badge>
      case 'refunded':
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">Refunded</Badge>
      case 'disputed':
        return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Disputed</Badge>
      default:
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">{status}</Badge>
    }
  }

  const getEscrowBadge = (status: string) => {
    switch (status) {
      case 'held':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Lock className="h-3 w-3 mr-1" />Held</Badge>
      case 'released':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><Unlock className="h-3 w-3 mr-1" />Released</Badge>
      case 'refunded':
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">Refunded</Badge>
      case 'disputed':
        return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Disputed</Badge>
      default:
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">{status}</Badge>
    }
  }

  const totalAmount = statsCounts.totalAmount
  const totalCommissions = statsCounts.totalCommissions
  const pendingEscrow = statsCounts.pendingEscrow
  const completedTransactions = statsCounts.completedCount

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Transactions</h1>
          <p className="text-slate-400 mt-1">Manage payments, escrow, and refunds</p>
        </div>
        <Button onClick={fetchTransactions} variant="outline" className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700 hover:border-slate-500 hover:text-white">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <CreditCard className="h-8 w-8 text-slate-400" />
              <div>
                <p className="text-2xl font-bold text-white">{pagination.total}</p>
                <p className="text-sm text-slate-400">Total Transactions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <DollarSign className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold text-white">{formatCurrency(totalAmount)}</p>
                <p className="text-sm text-slate-400">Total Volume</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <CheckCircle className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold text-white">{formatCurrency(totalCommissions)}</p>
                <p className="text-sm text-slate-400">Commissions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`bg-slate-900 border-slate-800 cursor-pointer transition-all hover:border-yellow-500/50 ${escrowFilter === 'held' ? 'border-yellow-500' : ''}`}
          onClick={() => setEscrowFilter(escrowFilter === 'held' ? 'all' : 'held')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Lock className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold text-white">{formatCurrency(pendingEscrow)}</p>
                <p className="text-sm text-slate-400">In Escrow</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
                <SelectItem value="disputed">Disputed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={escrowFilter} onValueChange={setEscrowFilter}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Escrow Status" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">All Escrow Status</SelectItem>
                <SelectItem value="held">Held</SelectItem>
                <SelectItem value="released">Released</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
                <SelectItem value="disputed">Disputed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Transactions ({pagination.total})</CardTitle>
          <CardDescription className="text-slate-400">Manage payments and escrow</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400">Order</TableHead>
                    <TableHead className="text-slate-400">Shop</TableHead>
                    <TableHead className="text-slate-400">Amount</TableHead>
                    <TableHead className="text-slate-400">Commission</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400">Escrow</TableHead>
                    <TableHead className="text-slate-400">Date</TableHead>
                    <TableHead className="text-slate-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id} className="border-slate-800 hover:bg-slate-800/50">
                      <TableCell>
                        <div>
                          <div className="font-medium text-white">{tx.order_number || 'N/A'}</div>
                          <div className="text-sm text-slate-500">{tx.customer_name || 'Guest'}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-300">{tx.shop_name}</TableCell>
                      <TableCell className="text-white font-medium">{formatCurrency(tx.amount)}</TableCell>
                      <TableCell className="text-emerald-400">{formatCurrency(tx.commission_amount)}</TableCell>
                      <TableCell>{getStatusBadge(tx.status)}</TableCell>
                      <TableCell>{getEscrowBadge(tx.escrow_status)}</TableCell>
                      <TableCell className="text-slate-400">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-white">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                            <DropdownMenuItem 
                              onClick={() => { setSelectedTransaction(tx); setShowDetailsModal(true) }}
                              className="text-slate-300 focus:bg-slate-700 focus:text-white"
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            {tx.escrow_status === 'held' && tx.status !== 'refunded' && (
                              <>
                                <DropdownMenuItem 
                                  onClick={() => { setSelectedTransaction(tx); setActionType('release'); setShowActionModal(true) }}
                                  className="text-emerald-400 focus:bg-slate-700 focus:text-emerald-300"
                                >
                                  <Unlock className="mr-2 h-4 w-4" />
                                  Release Escrow
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => { setSelectedTransaction(tx); setActionType('refund'); setShowActionModal(true) }}
                                  className="text-yellow-400 focus:bg-slate-700 focus:text-yellow-300"
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Refund
                                </DropdownMenuItem>
                              </>
                            )}
                            {tx.status !== 'disputed' && tx.status !== 'refunded' && (
                              <DropdownMenuItem 
                                onClick={() => { setSelectedTransaction(tx); setActionType('dispute'); setShowActionModal(true) }}
                                className="text-orange-400 focus:bg-slate-700 focus:text-orange-300"
                              >
                                <AlertTriangle className="mr-2 h-4 w-4" />
                                Mark Disputed
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
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

      {/* Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription className="text-slate-400">View transaction information</DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-400">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedTransaction.status)}</div>
                </div>
                <div>
                  <Label className="text-slate-400">Escrow</Label>
                  <div className="mt-1">{getEscrowBadge(selectedTransaction.escrow_status)}</div>
                </div>
                <div>
                  <Label className="text-slate-400">Order</Label>
                  <p className="text-white">{selectedTransaction.order_number}</p>
                </div>
                <div>
                  <Label className="text-slate-400">Shop</Label>
                  <p className="text-white">{selectedTransaction.shop_name}</p>
                </div>
                <div>
                  <Label className="text-slate-400">Customer</Label>
                  <p className="text-white">{selectedTransaction.customer_name || 'Guest'}</p>
                  <p className="text-sm text-slate-400">{selectedTransaction.customer_email}</p>
                </div>
                <div>
                  <Label className="text-slate-400">Payment Method</Label>
                  <p className="text-white">{selectedTransaction.payment_method || 'N/A'}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <Label className="text-slate-400 mb-3 block">Financial Breakdown</Label>
                <div className="grid grid-cols-3 gap-4">
                  <Card className="bg-slate-800 border-slate-700">
                    <CardContent className="pt-4 pb-4">
                      <DollarSign className="h-5 w-5 text-white mb-2" />
                      <p className="text-xl font-bold text-white">{formatCurrency(selectedTransaction.amount)}</p>
                      <p className="text-xs text-slate-400">Total Amount</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-emerald-500/10 border-emerald-500/30">
                    <CardContent className="pt-4 pb-4">
                      <DollarSign className="h-5 w-5 text-emerald-400 mb-2" />
                      <p className="text-xl font-bold text-white">{formatCurrency(selectedTransaction.commission_amount)}</p>
                      <p className="text-xs text-emerald-400">Commission</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-blue-500/10 border-blue-500/30">
                    <CardContent className="pt-4 pb-4">
                      <DollarSign className="h-5 w-5 text-blue-400 mb-2" />
                      <p className="text-xl font-bold text-white">{formatCurrency(selectedTransaction.seller_amount)}</p>
                      <p className="text-xs text-blue-400">Seller Amount</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {selectedTransaction.escrow_hold_until && (
                <div>
                  <Label className="text-slate-400">Escrow Hold Until</Label>
                  <p className="text-white">{new Date(selectedTransaction.escrow_hold_until).toLocaleString()}</p>
                </div>
              )}

              {selectedTransaction.refund_reason && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                  <Label className="text-red-400">Refund Reason</Label>
                  <p className="text-white mt-1">{selectedTransaction.refund_reason}</p>
                </div>
              )}

              {selectedTransaction.dispute_reason && (
                <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
                  <Label className="text-orange-400">Dispute Reason</Label>
                  <p className="text-white mt-1">{selectedTransaction.dispute_reason}</p>
                </div>
              )}

              {selectedTransaction.admin_notes && (
                <div>
                  <Label className="text-slate-400">Admin Notes</Label>
                  <p className="text-white">{selectedTransaction.admin_notes}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                <div>
                  <Label className="text-slate-400">Created</Label>
                  <p className="text-white">{new Date(selectedTransaction.created_at).toLocaleString()}</p>
                </div>
                {selectedTransaction.completed_at && (
                  <div>
                    <Label className="text-slate-400">Completed</Label>
                    <p className="text-white">{new Date(selectedTransaction.completed_at).toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Modal */}
      <Dialog open={showActionModal} onOpenChange={setShowActionModal}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'release' && 'Release Escrow'}
              {actionType === 'refund' && 'Refund Transaction'}
              {actionType === 'dispute' && 'Mark as Disputed'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {actionType === 'release' && 'This will release the held funds to the seller.'}
              {actionType === 'refund' && 'This will refund the transaction to the customer.'}
              {actionType === 'dispute' && 'This will mark the transaction as disputed for review.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedTransaction && (
              <>
                <div>
                  <Label className="text-slate-400">Transaction Amount</Label>
                  <p className="text-white text-xl font-semibold">{formatCurrency(selectedTransaction.amount)}</p>
                </div>
                {actionType === 'release' && (
                  <div>
                    <Label className="text-slate-400">Amount to Release (Seller)</Label>
                    <p className="text-emerald-400 text-xl font-semibold">{formatCurrency(selectedTransaction.seller_amount)}</p>
                  </div>
                )}
              </>
            )}
            
            {(actionType === 'refund' || actionType === 'dispute') && (
              <div>
                <Label htmlFor="action-reason" className="text-slate-400">Reason</Label>
                <Textarea
                  id="action-reason"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder={`Provide a reason for ${actionType}...`}
                  className="bg-slate-800 border-slate-700 text-white mt-1"
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowActionModal(false)} className="border-slate-700 text-slate-300">
                Cancel
              </Button>
              <Button
                onClick={handleAction}
                disabled={isProcessing || ((actionType === 'refund' || actionType === 'dispute') && !actionReason)}
                className={
                  actionType === 'release' 
                    ? 'bg-emerald-600 hover:bg-emerald-700' 
                    : actionType === 'dispute' 
                    ? 'bg-orange-600 hover:bg-orange-700'
                    : ''
                }
                variant={actionType === 'refund' ? 'destructive' : 'default'}
              >
                {isProcessing ? 'Processing...' : 
                  actionType === 'release' ? 'Release Escrow' :
                  actionType === 'refund' ? 'Refund' : 'Mark Disputed'
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

