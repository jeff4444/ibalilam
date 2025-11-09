'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { 
  CreditCard, 
  Search, 
  DollarSign, 
  Clock, 
  CheckCircle,
  XCircle,
  AlertTriangle,
  Home,
  Filter,
  MoreHorizontal,
  User,
  Calendar,
  Shield,
  Unlock,
  Lock
} from 'lucide-react'
import Link from 'next/link'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

interface Transaction {
  id: string
  order_id: string
  order_number: string
  customer_id: string
  customer_name: string
  customer_email: string
  seller_id: string
  seller_name: string
  seller_email: string
  amount: number
  commission_amount: number
  seller_amount: number
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'disputed'
  payment_method: string
  payment_intent_id: string
  escrow_status: 'held' | 'released' | 'refunded' | 'disputed'
  escrow_hold_until: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
  refunded_at: string | null
  refund_reason: string | null
  dispute_reason: string | null
  admin_notes: string | null
}

interface EscrowHold {
  id: string
  transaction_id: string
  amount: number
  hold_until: string
  status: 'active' | 'released' | 'refunded'
  reason: string
  created_at: string
  released_at: string | null
  refunded_at: string | null
}

export default function AdminPaymentsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [escrowHolds, setEscrowHolds] = useState<EscrowHold[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [escrowFilter, setEscrowFilter] = useState('all')
  const [dateRange, setDateRange] = useState('all')
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [showTransactionModal, setShowTransactionModal] = useState(false)
  const [showEscrowModal, setShowEscrowModal] = useState(false)
  const [actionType, setActionType] = useState<'release' | 'refund'>('release')
  const [actionReason, setActionReason] = useState('')
  const [adminNotes, setAdminNotes] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        router.push('/login')
        return
      }

      try {
        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select('user_role, is_admin')
          .eq('user_id', user.id)
          .single()

        if (error || !profile || !profile.is_admin) {
          router.push('/dashboard')
          return
        }

        fetchTransactions()
        fetchEscrowHolds()
      } catch (error) {
        console.error('Error checking admin status:', error)
        router.push('/dashboard')
      }
    }

    if (user) {
      checkAdminStatus()
    }
  }, [user?.id])

  const fetchTransactions = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          orders!inner(
            order_number,
            customer_id,
            customer_name,
            customer_email,
            shop_id,
            shops!inner(
              name,
              user_id
            )
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      const transformedTransactions = data?.map(transaction => ({
        id: transaction.id,
        order_id: transaction.order_id,
        order_number: transaction.orders?.order_number || 'N/A',
        customer_id: transaction.orders?.customer_id || '',
        customer_name: transaction.orders?.customer_name || 'Guest',
        customer_email: transaction.orders?.customer_email || '',
        seller_id: transaction.orders?.shops?.user_id || '',
        seller_name: 'Unknown', // We can't access user profile data directly
        seller_email: '', // We can't access auth.users email directly
        amount: transaction.amount,
        commission_amount: transaction.commission_amount || 0,
        seller_amount: transaction.seller_amount || 0,
        status: transaction.status,
        payment_method: transaction.payment_method,
        payment_intent_id: transaction.payment_intent_id,
        escrow_status: transaction.escrow_status || 'held',
        escrow_hold_until: transaction.escrow_hold_until,
        created_at: transaction.created_at,
        updated_at: transaction.updated_at,
        completed_at: transaction.completed_at,
        refunded_at: transaction.refunded_at,
        refund_reason: transaction.refund_reason,
        dispute_reason: transaction.dispute_reason,
        admin_notes: transaction.admin_notes
      })) || []

      setTransactions(transformedTransactions)
    } catch (err: any) {
      console.error('Error fetching transactions:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchEscrowHolds = async () => {
    try {
      const { data, error } = await supabase
        .from('escrow_holds')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setEscrowHolds(data || [])
    } catch (err: any) {
      console.error('Error fetching escrow holds:', err)
    }
  }

  const handleEscrowAction = async (transactionId: string, action: 'release' | 'refund') => {
    try {
      setIsProcessing(true)
      setError(null)

      const updateData: any = {
        escrow_status: action === 'release' ? 'released' : 'refunded',
        admin_notes: adminNotes
      }

      if (action === 'refund') {
        updateData.refunded_at = new Date().toISOString()
        updateData.refund_reason = actionReason
        updateData.status = 'refunded'
      } else {
        updateData.completed_at = new Date().toISOString()
        updateData.status = 'completed'
      }

      const { error } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('id', transactionId)

      if (error) throw error

      setShowEscrowModal(false)
      setSelectedTransaction(null)
      setActionReason('')
      setAdminNotes('')
      fetchTransactions()
    } catch (err: any) {
      console.error('Error processing escrow action:', err)
      setError(err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = searchTerm === '' || 
      transaction.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.seller_name.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || transaction.status === statusFilter
    const matchesEscrow = escrowFilter === 'all' || transaction.escrow_status === escrowFilter

    let matchesDate = true
    if (dateRange !== 'all') {
      const now = new Date()
      const transactionDate = new Date(transaction.created_at)
      
      switch (dateRange) {
        case 'today':
          matchesDate = transactionDate.toDateString() === now.toDateString()
          break
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          matchesDate = transactionDate >= weekAgo
          break
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          matchesDate = transactionDate >= monthAgo
          break
      }
    }

    return matchesSearch && matchesStatus && matchesEscrow && matchesDate
  })

  const totalVolume = transactions.reduce((sum, t) => sum + t.amount, 0)
  const totalCommission = transactions.reduce((sum, t) => sum + (t.commission_amount || 0), 0)
  const pendingEscrow = transactions.filter(t => t.escrow_status === 'held').length
  const disputedTransactions = transactions.filter(t => t.status === 'disputed').length

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading transactions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payment Management</h1>
          <p className="text-muted-foreground">
            Manage transactions, escrow holds, and payment disputes
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button asChild variant="secondary">
            <Link href="/admin">
              <Home className="mr-2 h-4 w-4" />
              Admin Dashboard
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalVolume.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              All transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Commission Earned</CardTitle>
            <CreditCard className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCommission.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Platform revenue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Escrow Holds</CardTitle>
            <Lock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingEscrow}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting release
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disputes</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{disputedTransactions}</div>
            <p className="text-xs text-muted-foreground">
              Require attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction Search & Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
                <SelectItem value="disputed">Disputed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={escrowFilter} onValueChange={setEscrowFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Escrow status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All escrow status</SelectItem>
                <SelectItem value="held">Held</SelectItem>
                <SelectItem value="released">Released</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
                <SelectItem value="disputed">Disputed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger>
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last 7 days</SelectItem>
                <SelectItem value="month">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transactions ({filteredTransactions.length})</CardTitle>
          <CardDescription>Manage payment transactions and escrow holds</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Escrow</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell className="font-medium">{transaction.order_number}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{transaction.customer_name}</div>
                      <div className="text-sm text-muted-foreground">{transaction.customer_email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{transaction.seller_name}</div>
                      <div className="text-sm text-muted-foreground">{transaction.seller_email}</div>
                    </div>
                  </TableCell>
                  <TableCell>${transaction.amount.toFixed(2)}</TableCell>
                  <TableCell>${(transaction.commission_amount || 0).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={
                      transaction.status === 'completed' ? 'default' :
                      transaction.status === 'pending' ? 'secondary' :
                      transaction.status === 'processing' ? 'secondary' :
                      transaction.status === 'failed' ? 'destructive' :
                      transaction.status === 'refunded' ? 'destructive' :
                      transaction.status === 'disputed' ? 'destructive' : 'outline'
                    }>
                      {transaction.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      transaction.escrow_status === 'held' ? 'secondary' :
                      transaction.escrow_status === 'released' ? 'default' :
                      transaction.escrow_status === 'refunded' ? 'destructive' :
                      transaction.escrow_status === 'disputed' ? 'destructive' : 'outline'
                    }>
                      {transaction.escrow_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(transaction.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          setSelectedTransaction(transaction)
                          setShowTransactionModal(true)
                        }}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        {transaction.escrow_status === 'held' && (
                          <>
                            <DropdownMenuItem onClick={() => {
                              setSelectedTransaction(transaction)
                              setActionType('release')
                              setShowEscrowModal(true)
                            }}>
                              <Unlock className="mr-2 h-4 w-4" />
                              Release Escrow
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setSelectedTransaction(transaction)
                              setActionType('refund')
                              setShowEscrowModal(true)
                            }}>
                              <XCircle className="mr-2 h-4 w-4" />
                              Refund Transaction
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Transaction Details Modal */}
      <Dialog open={showTransactionModal} onOpenChange={setShowTransactionModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>View detailed transaction information</DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Order Number</Label>
                  <p className="text-sm">{selectedTransaction.order_number}</p>
                </div>
                <div>
                  <Label>Transaction ID</Label>
                  <p className="text-sm">{selectedTransaction.id}</p>
                </div>
                <div>
                  <Label>Customer</Label>
                  <p className="text-sm">{selectedTransaction.customer_name} ({selectedTransaction.customer_email})</p>
                </div>
                <div>
                  <Label>Seller</Label>
                  <p className="text-sm">{selectedTransaction.seller_name} ({selectedTransaction.seller_email})</p>
                </div>
                <div>
                  <Label>Amount</Label>
                  <p className="text-sm">${selectedTransaction.amount.toFixed(2)}</p>
                </div>
                <div>
                  <Label>Commission</Label>
                  <p className="text-sm">${(selectedTransaction.commission_amount || 0).toFixed(2)}</p>
                </div>
                <div>
                  <Label>Seller Amount</Label>
                  <p className="text-sm">${(selectedTransaction.seller_amount || 0).toFixed(2)}</p>
                </div>
                <div>
                  <Label>Payment Method</Label>
                  <p className="text-sm">{selectedTransaction.payment_method}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <p className="text-sm">{selectedTransaction.status}</p>
                </div>
                <div>
                  <Label>Escrow Status</Label>
                  <p className="text-sm">{selectedTransaction.escrow_status}</p>
                </div>
                <div>
                  <Label>Created</Label>
                  <p className="text-sm">{new Date(selectedTransaction.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <Label>Updated</Label>
                  <p className="text-sm">{new Date(selectedTransaction.updated_at).toLocaleString()}</p>
                </div>
              </div>

              {selectedTransaction.refund_reason && (
                <div>
                  <Label>Refund Reason</Label>
                  <p className="text-sm text-red-600">{selectedTransaction.refund_reason}</p>
                </div>
              )}

              {selectedTransaction.dispute_reason && (
                <div>
                  <Label>Dispute Reason</Label>
                  <p className="text-sm text-red-600">{selectedTransaction.dispute_reason}</p>
                </div>
              )}

              {selectedTransaction.admin_notes && (
                <div>
                  <Label>Admin Notes</Label>
                  <p className="text-sm">{selectedTransaction.admin_notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Escrow Action Modal */}
      <Dialog open={showEscrowModal} onOpenChange={setShowEscrowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'release' ? 'Release Escrow' : 'Refund Transaction'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'release' 
                ? 'This will release the escrow funds to the seller and mark the transaction as completed.'
                : 'This will refund the transaction to the customer and mark it as refunded.'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedTransaction && (
              <div>
                <Label>Transaction</Label>
                <p className="text-sm">{selectedTransaction.order_number} - ${selectedTransaction.amount.toFixed(2)}</p>
              </div>
            )}
            
            {actionType === 'refund' && (
              <div>
                <Label htmlFor="refund-reason">Refund Reason</Label>
                <Textarea
                  id="refund-reason"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Please provide a reason for the refund..."
                  required
                />
              </div>
            )}

            <div>
              <Label htmlFor="admin-notes">Admin Notes</Label>
              <Textarea
                id="admin-notes"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add notes about this action..."
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowEscrowModal(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => selectedTransaction && handleEscrowAction(selectedTransaction.id, actionType)}
                variant={actionType === 'release' ? 'default' : 'destructive'}
                disabled={isProcessing || (actionType === 'refund' && !actionReason)}
              >
                {isProcessing ? 'Processing...' : actionType === 'release' ? 'Release Escrow' : 'Refund Transaction'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
