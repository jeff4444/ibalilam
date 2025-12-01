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
import { createClient } from '@/utils/supabase/client'
import { 
  Users, 
  Search, 
  UserCheck, 
  UserX, 
  Eye, 
  Clock,
  CheckCircle,
  XCircle,
  MoreHorizontal,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Shield
} from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

interface User {
  id: string
  full_name: string
  user_role: 'visitor' | 'buyer' | 'seller'
  is_admin: boolean
  fica_status: 'pending' | 'verified' | 'rejected' | null
  fica_rejection_reason?: string
  fica_verified_at?: string
  created_at: string
  is_suspended: boolean
  suspension_reason?: string
  suspension_until?: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [ficaFilter, setFicaFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showUserModal, setShowUserModal] = useState(false)
  const [showFicaModal, setShowFicaModal] = useState(false)
  const [ficaAction, setFicaAction] = useState<'approve' | 'reject'>('approve')
  const [rejectionReason, setRejectionReason] = useState('')
  const [suspensionReason, setSuspensionReason] = useState('')
  const [suspensionDays, setSuspensionDays] = useState(7)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const supabase = createClient()

  useEffect(() => {
    fetchUsers()
  }, [searchTerm, roleFilter, ficaFilter, statusFilter, pagination.page])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      })
      
      if (searchTerm) params.set('search', searchTerm)
      if (roleFilter !== 'all') params.set('role', roleFilter)
      if (ficaFilter !== 'all') params.set('fica_status', ficaFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)

      const response = await fetch(`/api/admin/users?${params}`)
      const data = await response.json()
      
      if (response.ok) {
        setUsers(data.users)
        setPagination(prev => ({ ...prev, ...data.pagination }))
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFicaAction = async () => {
    if (!selectedUser) return

    try {
      setIsProcessing(true)

      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedUser.id,
          action: ficaAction === 'approve' ? 'approve_fica' : 'reject_fica',
          rejection_reason: rejectionReason
        })
      })

      if (response.ok) {
        setShowFicaModal(false)
        setSelectedUser(null)
        setRejectionReason('')
        fetchUsers()
      }
    } catch (error) {
      console.error('Error processing FICA action:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSuspendUser = async () => {
    if (!selectedUser) return

    try {
      setIsProcessing(true)

      const suspensionUntil = new Date()
      suspensionUntil.setDate(suspensionUntil.getDate() + suspensionDays)

      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedUser.id,
          action: 'suspend',
          suspension_reason: suspensionReason,
          suspension_until: suspensionUntil.toISOString()
        })
      })

      if (response.ok) {
        setShowUserModal(false)
        setSelectedUser(null)
        setSuspensionReason('')
        fetchUsers()
      }
    } catch (error) {
      console.error('Error suspending user:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleUnsuspendUser = async (userId: string) => {
    try {
      setIsProcessing(true)

      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          action: 'unsuspend'
        })
      })

      if (response.ok) {
        fetchUsers()
      }
    } catch (error) {
      console.error('Error unsuspending user:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const getFicaStatusBadge = (status: string | null) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Verified</Badge>
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pending</Badge>
      case 'rejected':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Rejected</Badge>
      default:
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">Not Submitted</Badge>
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Users</h1>
          <p className="text-slate-400 mt-1">Manage platform users and their accounts</p>
        </div>
        <Button onClick={fetchUsers} variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Users className="h-8 w-8 text-slate-400" />
              <div>
                <p className="text-2xl font-bold text-white">{pagination.total}</p>
                <p className="text-sm text-slate-400">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Clock className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold text-white">{users.filter(u => u.fica_status === 'pending').length}</p>
                <p className="text-sm text-slate-400">Pending FICA</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <CheckCircle className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold text-white">{users.filter(u => u.fica_status === 'verified').length}</p>
                <p className="text-sm text-slate-400">Verified</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <UserX className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold text-white">{users.filter(u => u.is_suspended).length}</p>
                <p className="text-sm text-slate-400">Suspended</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
            
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="visitor">Visitor</SelectItem>
                <SelectItem value="buyer">Buyer</SelectItem>
                <SelectItem value="seller">Seller</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>

            <Select value={ficaFilter} onValueChange={setFicaFilter}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="FICA Status" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">All FICA Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="null">Not Submitted</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Account Status" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Users ({pagination.total})</CardTitle>
          <CardDescription className="text-slate-400">Manage user accounts and permissions</CardDescription>
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
                    <TableHead className="text-slate-400">User</TableHead>
                    <TableHead className="text-slate-400">Role</TableHead>
                    <TableHead className="text-slate-400">FICA Status</TableHead>
                    <TableHead className="text-slate-400">Account Status</TableHead>
                    <TableHead className="text-slate-400">Joined</TableHead>
                    <TableHead className="text-slate-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} className="border-slate-800 hover:bg-slate-800/50">
                      <TableCell>
                        <div>
                          <div className="font-medium text-white">{user.full_name || 'No name'}</div>
                          <div className="text-sm text-slate-500">{user.id.slice(0, 8)}...</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-slate-600 text-slate-300">
                            {user.user_role}
                          </Badge>
                          {user.is_admin && (
                            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                              <Shield className="h-3 w-3 mr-1" />
                              Admin
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getFicaStatusBadge(user.fica_status)}
                      </TableCell>
                      <TableCell>
                        {user.is_suspended ? (
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Suspended</Badge>
                        ) : (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-400">
                        {new Date(user.created_at).toLocaleDateString()}
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
                              onClick={() => { setSelectedUser(user); setShowUserModal(true) }}
                              className="text-slate-300 focus:bg-slate-700 focus:text-white"
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            {user.fica_status === 'pending' && (
                              <>
                                <DropdownMenuItem 
                                  onClick={() => { setSelectedUser(user); setFicaAction('approve'); setShowFicaModal(true) }}
                                  className="text-emerald-400 focus:bg-slate-700 focus:text-emerald-300"
                                >
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Approve FICA
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => { setSelectedUser(user); setFicaAction('reject'); setShowFicaModal(true) }}
                                  className="text-red-400 focus:bg-slate-700 focus:text-red-300"
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Reject FICA
                                </DropdownMenuItem>
                              </>
                            )}
                            {!user.is_suspended ? (
                              <DropdownMenuItem 
                                onClick={() => { setSelectedUser(user); setShowUserModal(true) }}
                                className="text-red-400 focus:bg-slate-700 focus:text-red-300"
                              >
                                <UserX className="mr-2 h-4 w-4" />
                                Suspend User
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem 
                                onClick={() => handleUnsuspendUser(user.id)}
                                className="text-emerald-400 focus:bg-slate-700 focus:text-emerald-300"
                              >
                                <UserCheck className="mr-2 h-4 w-4" />
                                Unsuspend User
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

      {/* User Details Modal */}
      <Dialog open={showUserModal} onOpenChange={setShowUserModal}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription className="text-slate-400">View and manage user account</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-400">Name</Label>
                  <p className="text-white">{selectedUser.full_name || 'No name'}</p>
                </div>
                <div>
                  <Label className="text-slate-400">User ID</Label>
                  <p className="text-white text-sm">{selectedUser.id}</p>
                </div>
                <div>
                  <Label className="text-slate-400">Role</Label>
                  <p className="text-white">{selectedUser.user_role}</p>
                </div>
                <div>
                  <Label className="text-slate-400">FICA Status</Label>
                  <p className="text-white">{selectedUser.fica_status || 'Not submitted'}</p>
                </div>
                <div>
                  <Label className="text-slate-400">Account Status</Label>
                  <p className="text-white">{selectedUser.is_suspended ? 'Suspended' : 'Active'}</p>
                </div>
                <div>
                  <Label className="text-slate-400">Admin Access</Label>
                  <p className="text-white">{selectedUser.is_admin ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <Label className="text-slate-400">Joined</Label>
                  <p className="text-white">{new Date(selectedUser.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              {selectedUser.fica_rejection_reason && (
                <div>
                  <Label className="text-slate-400">FICA Rejection Reason</Label>
                  <p className="text-red-400">{selectedUser.fica_rejection_reason}</p>
                </div>
              )}

              {selectedUser.suspension_reason && (
                <div>
                  <Label className="text-slate-400">Suspension Reason</Label>
                  <p className="text-red-400">{selectedUser.suspension_reason}</p>
                </div>
              )}

              {!selectedUser.is_suspended && (
                <div className="space-y-4 pt-4 border-t border-slate-800">
                  <div>
                    <Label htmlFor="suspension-reason" className="text-slate-400">Suspension Reason</Label>
                    <Textarea
                      id="suspension-reason"
                      value={suspensionReason}
                      onChange={(e) => setSuspensionReason(e.target.value)}
                      placeholder="Reason for suspension..."
                      className="bg-slate-800 border-slate-700 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="suspension-days" className="text-slate-400">Suspension Duration (days)</Label>
                    <Input
                      id="suspension-days"
                      type="number"
                      value={suspensionDays}
                      onChange={(e) => setSuspensionDays(parseInt(e.target.value))}
                      min="1"
                      max="365"
                      className="bg-slate-800 border-slate-700 text-white mt-1"
                    />
                  </div>
                  <Button 
                    onClick={handleSuspendUser} 
                    variant="destructive"
                    disabled={isProcessing || !suspensionReason}
                  >
                    {isProcessing ? 'Suspending...' : 'Suspend User'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* FICA Action Modal */}
      <Dialog open={showFicaModal} onOpenChange={setShowFicaModal}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>
              {ficaAction === 'approve' ? 'Approve FICA' : 'Reject FICA'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {ficaAction === 'approve' 
                ? 'This will verify the user\'s FICA documents and allow them to sell on the platform.'
                : 'This will reject the user\'s FICA documents. Please provide a reason.'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedUser && (
              <div>
                <Label className="text-slate-400">User</Label>
                <p className="text-white">{selectedUser.full_name}</p>
              </div>
            )}
            
            {ficaAction === 'reject' && (
              <div>
                <Label htmlFor="rejection-reason" className="text-slate-400">Rejection Reason</Label>
                <Textarea
                  id="rejection-reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Please provide a reason for rejection..."
                  className="bg-slate-800 border-slate-700 text-white mt-1"
                  required
                />
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowFicaModal(false)} className="border-slate-700 text-slate-300">
                Cancel
              </Button>
              <Button 
                onClick={handleFicaAction}
                variant={ficaAction === 'approve' ? 'default' : 'destructive'}
                disabled={isProcessing || (ficaAction === 'reject' && !rejectionReason)}
                className={ficaAction === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              >
                {isProcessing ? 'Processing...' : ficaAction === 'approve' ? 'Approve' : 'Reject'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
