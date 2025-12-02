'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  ArrowUpFromLine,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  User,
  Wallet,
  Check,
  X
} from 'lucide-react'

interface WithdrawalRequest {
  id: string
  walletId: string
  amount: number
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
  description: string
  metadata: {
    bankDetails?: any
    userName?: string
    userEmail?: string
    requestedAmount?: number
    availableBalanceAtRequest?: number
    rejectionReason?: string
  }
  createdAt: string
  updatedAt: string
  user: {
    id: string
    name: string
    email: string
    availableBalance: number
  }
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface Stats {
  pendingCount: number
  pendingTotal: number
}

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [stats, setStats] = useState<Stats>({ pendingCount: 0, pendingTotal: 0 })
  
  // Modal states
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRequest | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchWithdrawals()
  }, [statusFilter, pagination.page])

  const fetchWithdrawals = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        status: statusFilter
      })

      const response = await fetch(`/api/admin/withdrawals?${params}`)
      const data = await response.json()
      
      if (response.ok) {
        setWithdrawals(data.withdrawals)
        setPagination(prev => ({ ...prev, ...data.pagination }))
        setStats(data.stats)
      } else {
        setError(data.error || 'Failed to fetch withdrawals')
      }
    } catch (error) {
      console.error('Error fetching withdrawals:', error)
      setError('Failed to fetch withdrawals')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!selectedWithdrawal) return

    try {
      setIsProcessing(true)
      setError(null)

      const response = await fetch('/api/admin/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: selectedWithdrawal.id,
          action: 'approve'
        })
      })

      const data = await response.json()

      if (response.ok) {
        setSuccessMessage(`Withdrawal of R${selectedWithdrawal.amount.toFixed(2)} approved successfully`)
        setShowApproveModal(false)
        setSelectedWithdrawal(null)
        fetchWithdrawals()
      } else {
        setError(data.error || 'Failed to approve withdrawal')
      }
    } catch (error) {
      console.error('Error approving withdrawal:', error)
      setError('Failed to approve withdrawal')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedWithdrawal) return

    try {
      setIsProcessing(true)
      setError(null)

      const response = await fetch('/api/admin/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: selectedWithdrawal.id,
          action: 'reject',
          rejectionReason: rejectionReason || 'Rejected by admin'
        })
      })

      const data = await response.json()

      if (response.ok) {
        setSuccessMessage(`Withdrawal request rejected`)
        setShowRejectModal(false)
        setSelectedWithdrawal(null)
        setRejectionReason('')
        fetchWithdrawals()
      } else {
        setError(data.error || 'Failed to reject withdrawal')
      }
    } catch (error) {
      console.error('Error rejecting withdrawal:', error)
      setError('Failed to reject withdrawal')
    } finally {
      setIsProcessing(false)
    }
  }

  const openApproveModal = (withdrawal: WithdrawalRequest) => {
    setSelectedWithdrawal(withdrawal)
    setShowApproveModal(true)
    setError(null)
  }

  const openRejectModal = (withdrawal: WithdrawalRequest) => {
    setSelectedWithdrawal(withdrawal)
    setShowRejectModal(true)
    setRejectionReason('')
    setError(null)
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
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        )
      case 'completed':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        )
      case 'failed':
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        )
      case 'cancelled':
        return (
          <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">
            <XCircle className="h-3 w-3 mr-1" />
            Cancelled
          </Badge>
        )
      default:
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">{status}</Badge>
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Withdrawal Requests</h1>
          <p className="text-slate-400 mt-1">Review and process user withdrawal requests</p>
        </div>
        <Button onClick={fetchWithdrawals} variant="outline" className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700 hover:border-slate-500 hover:text-white">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive" className="bg-red-500/10 border-red-500/30">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="bg-emerald-500/10 border-emerald-500/30">
          <CheckCircle className="h-4 w-4 text-emerald-400" />
          <AlertDescription className="text-emerald-400">{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Clock className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold text-white">{stats.pendingCount}</p>
                <p className="text-sm text-slate-400">Pending Requests</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <ArrowUpFromLine className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold text-white">{formatCurrency(stats.pendingTotal)}</p>
                <p className="text-sm text-slate-400">Pending Total Amount</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPagination(prev => ({ ...prev, page: 1 })) }}>
              <SelectTrigger className="w-48 bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Approved</SelectItem>
                <SelectItem value="failed">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Withdrawals Table */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Withdrawal Requests</CardTitle>
          <CardDescription className="text-slate-400">
            {statusFilter === 'pending' ? 'Pending requests awaiting approval' : 'All withdrawal requests'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
          ) : withdrawals.length === 0 ? (
            <div className="text-center py-8">
              <ArrowUpFromLine className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No withdrawal requests found</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400">User</TableHead>
                    <TableHead className="text-slate-400">Amount</TableHead>
                    <TableHead className="text-slate-400">Current Balance</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400">Requested</TableHead>
                    <TableHead className="text-slate-400">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdrawals.map((withdrawal) => (
                    <TableRow key={withdrawal.id} className="border-slate-800 hover:bg-slate-800/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-slate-700 flex items-center justify-center">
                            <User className="h-4 w-4 text-slate-400" />
                          </div>
                          <div>
                            <p className="text-white font-medium">{withdrawal.user.name}</p>
                            <p className="text-sm text-slate-500">{withdrawal.user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-red-400 font-semibold text-lg">
                        {formatCurrency(withdrawal.amount)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Wallet className="h-4 w-4 text-emerald-400" />
                          <span className={`font-medium ${
                            withdrawal.user.availableBalance >= withdrawal.amount 
                              ? 'text-emerald-400' 
                              : 'text-red-400'
                          }`}>
                            {formatCurrency(withdrawal.user.availableBalance)}
                          </span>
                        </div>
                        {withdrawal.user.availableBalance < withdrawal.amount && withdrawal.status === 'pending' && (
                          <p className="text-xs text-red-400 mt-1">Insufficient funds</p>
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(withdrawal.status)}
                        {withdrawal.status === 'failed' && withdrawal.metadata?.rejectionReason && (
                          <p className="text-xs text-slate-500 mt-1">
                            {withdrawal.metadata.rejectionReason}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-400">
                        <div>
                          <p>{new Date(withdrawal.createdAt).toLocaleDateString()}</p>
                          <p className="text-xs text-slate-500">
                            {new Date(withdrawal.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {withdrawal.status === 'pending' ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => openApproveModal(withdrawal)}
                              className="bg-emerald-600 hover:bg-emerald-700"
                              disabled={withdrawal.user.availableBalance < withdrawal.amount}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openRejectModal(withdrawal)}
                              className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                            >
                              <X className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
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
                    Page {pagination.page} of {pagination.totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page >= pagination.totalPages}
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

      {/* Approve Modal */}
      <Dialog open={showApproveModal} onOpenChange={setShowApproveModal}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              Approve Withdrawal
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              This will deduct the amount from the user's wallet balance.
            </DialogDescription>
          </DialogHeader>
          
          {selectedWithdrawal && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-slate-800 space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-400">User</span>
                  <span className="text-white font-medium">{selectedWithdrawal.user.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Email</span>
                  <span className="text-white">{selectedWithdrawal.user.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Withdrawal Amount</span>
                  <span className="text-red-400 font-bold">{formatCurrency(selectedWithdrawal.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Current Balance</span>
                  <span className="text-emerald-400 font-medium">{formatCurrency(selectedWithdrawal.user.availableBalance)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-700 pt-3">
                  <span className="text-slate-400">New Balance</span>
                  <span className="text-white font-bold">
                    {formatCurrency(selectedWithdrawal.user.availableBalance - selectedWithdrawal.amount)}
                  </span>
                </div>
              </div>

              {selectedWithdrawal.user.availableBalance < selectedWithdrawal.amount && (
                <Alert className="bg-red-500/10 border-red-500/30">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  <AlertDescription className="text-red-400">
                    User has insufficient balance to complete this withdrawal.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowApproveModal(false)} 
              className="border-slate-700 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={isProcessing || (selectedWithdrawal && selectedWithdrawal.user.availableBalance < selectedWithdrawal.amount)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isProcessing ? 'Processing...' : 'Confirm Approval'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Reject Withdrawal
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              This will reject the withdrawal request. The user's balance will remain unchanged.
            </DialogDescription>
          </DialogHeader>
          
          {selectedWithdrawal && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-slate-800 space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-400">User</span>
                  <span className="text-white font-medium">{selectedWithdrawal.user.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Withdrawal Amount</span>
                  <span className="text-red-400 font-bold">{formatCurrency(selectedWithdrawal.amount)}</span>
                </div>
              </div>

              <div>
                <Label htmlFor="rejection-reason" className="text-slate-400">Rejection Reason (optional)</Label>
                <Textarea
                  id="rejection-reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason for rejection..."
                  className="bg-slate-800 border-slate-700 text-white mt-1"
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowRejectModal(false)} 
              className="border-slate-700 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={isProcessing}
              className="bg-red-600 hover:bg-red-700"
            >
              {isProcessing ? 'Processing...' : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

