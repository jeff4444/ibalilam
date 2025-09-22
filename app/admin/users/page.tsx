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
  Users, 
  Search, 
  Shield, 
  UserCheck, 
  UserX, 
  FileText, 
  Eye, 
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Home,
  Filter,
  MoreHorizontal
} from 'lucide-react'
import Link from 'next/link'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

interface User {
  id: string
  email: string
  full_name: string
  user_role: 'visitor' | 'buyer' | 'seller' | 'admin' | 'support'
  fica_status: 'pending' | 'verified' | 'rejected' | null
  fica_rejection_reason?: string
  fica_verified_at?: string
  fica_reviewed_at?: string
  created_at: string
  last_sign_in_at?: string
  is_suspended: boolean
  suspension_reason?: string
  suspension_until?: string
}

interface AuditLog {
  id: string
  user_id: string
  action: string
  performed_by: string
  reason?: string
  created_at: string
  performer_name?: string
  user_name?: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [ficaFilter, setFicaFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showUserModal, setShowUserModal] = useState(false)
  const [showFicaModal, setShowFicaModal] = useState(false)
  const [showAuditModal, setShowAuditModal] = useState(false)
  const [ficaAction, setFicaAction] = useState<'approve' | 'reject'>('approve')
  const [rejectionReason, setRejectionReason] = useState('')
  const [suspensionReason, setSuspensionReason] = useState('')
  const [suspensionDays, setSuspensionDays] = useState(7)
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
          .select('user_role')
          .eq('user_id', user.id)
          .single()

        if (error || !profile || profile.user_role !== 'admin') {
          router.push('/dashboard')
          return
        }

        fetchUsers()
        fetchAuditLogs()
      } catch (error) {
        console.error('Error checking admin status:', error)
        router.push('/dashboard')
      }
    }

    if (user) {
      checkAdminStatus()
    }
  }, [user?.id])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      const transformedUsers = data?.map(profile => ({
        id: profile.user_id,
        email: '', // We can't access auth.users email directly
        full_name: profile.full_name || (profile.first_name && profile.last_name ? `${profile.first_name} ${profile.last_name}` : (profile.first_name || profile.last_name || '')),
        user_role: profile.user_role,
        fica_status: profile.fica_status,
        fica_rejection_reason: profile.fica_rejection_reason,
        fica_verified_at: profile.fica_verified_at,
        fica_reviewed_at: profile.fica_reviewed_at,
        created_at: profile.created_at,
        last_sign_in_at: undefined, // We can't access this directly
        is_suspended: profile.is_suspended || false,
        suspension_reason: profile.suspension_reason,
        suspension_until: profile.suspension_until
      })) || []

      setUsers(transformedUsers)
    } catch (err: any) {
      console.error('Error fetching users:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchAuditLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('fica_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      const transformedLogs = data?.map(log => ({
        id: log.id,
        user_id: log.user_id,
        action: log.action,
        performed_by: log.performed_by,
        reason: log.reason,
        created_at: log.created_at,
        performer_name: 'Unknown', // We can't access user profile data directly
        user_name: 'Unknown' // We can't access user profile data directly
      })) || []

      setAuditLogs(transformedLogs)
    } catch (err: any) {
      console.error('Error fetching audit logs:', err)
    }
  }

  const handleFicaAction = async () => {
    if (!selectedUser) return

    try {
      setIsProcessing(true)
      setError(null)

      const updateData: any = {
        fica_status: ficaAction === 'approve' ? 'verified' : 'rejected',
        fica_reviewed_at: new Date().toISOString(),
        fica_reviewed_by: user?.id
      }

      if (ficaAction === 'reject') {
        updateData.fica_rejection_reason = rejectionReason
      } else if (ficaAction === 'approve') {
        updateData.fica_verified_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('user_id', selectedUser.id)

      if (error) throw error

      // Log the action
      await supabase
        .from('fica_audit_log')
        .insert({
          user_id: selectedUser.id,
          action: ficaAction === 'approve' ? 'approved' : 'rejected',
          performed_by: user?.id,
          reason: ficaAction === 'reject' ? rejectionReason : null
        })

      setShowFicaModal(false)
      setSelectedUser(null)
      setRejectionReason('')
      fetchUsers()
      fetchAuditLogs()
    } catch (err: any) {
      console.error('Error processing FICA action:', err)
      setError(err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSuspendUser = async () => {
    if (!selectedUser) return

    try {
      setIsProcessing(true)
      setError(null)

      const suspensionUntil = new Date()
      suspensionUntil.setDate(suspensionUntil.getDate() + suspensionDays)

      const { error } = await supabase
        .from('user_profiles')
        .update({
          is_suspended: true,
          suspension_reason: suspensionReason,
          suspension_until: suspensionUntil.toISOString()
        })
        .eq('user_id', selectedUser.id)

      if (error) throw error

      setShowUserModal(false)
      setSelectedUser(null)
      setSuspensionReason('')
      fetchUsers()
    } catch (err: any) {
      console.error('Error suspending user:', err)
      setError(err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleUnsuspendUser = async (userId: string) => {
    try {
      setIsProcessing(true)
      setError(null)

      const { error } = await supabase
        .from('user_profiles')
        .update({
          is_suspended: false,
          suspension_reason: null,
          suspension_until: null
        })
        .eq('user_id', userId)

      if (error) throw error

      fetchUsers()
    } catch (err: any) {
      console.error('Error unsuspending user:', err)
      setError(err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = searchTerm === '' || 
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesRole = roleFilter === 'all' || user.user_role === roleFilter
    const matchesFica = ficaFilter === 'all' || user.fica_status === ficaFilter
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'suspended' && user.is_suspended) ||
      (statusFilter === 'active' && !user.is_suspended)

    return matchesSearch && matchesRole && matchesFica && matchesStatus
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading users...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">
            Manage users, FICA verification, and account status
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button asChild variant="secondary">
            <Link href="/admin">
              <Home className="mr-2 h-4 w-4" />
              Admin Dashboard
            </Link>
          </Button>
          <Button onClick={() => setShowAuditModal(true)} variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            Audit Logs
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
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground">
              Registered users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending FICA</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.fica_status === 'pending').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Awaiting review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verified Sellers</CardTitle>
            <UserCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.user_role === 'seller' && u.fica_status === 'verified').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Can sell on platform
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspended Users</CardTitle>
            <UserX className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.is_suspended).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Account restrictions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>User Search & Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="visitor">Visitor</SelectItem>
                <SelectItem value="buyer">Buyer</SelectItem>
                <SelectItem value="seller">Seller</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="support">Support</SelectItem>
              </SelectContent>
            </Select>

            <Select value={ficaFilter} onValueChange={setFicaFilter}>
              <SelectTrigger>
                <SelectValue placeholder="FICA status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All FICA status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="null">Not submitted</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Account status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({filteredUsers.length})</CardTitle>
          <CardDescription>Manage user accounts and permissions</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>FICA Status</TableHead>
                <TableHead>Account Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Last Sign In</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{user.full_name || 'No name'}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{user.user_role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      user.fica_status === 'verified' ? 'default' :
                      user.fica_status === 'pending' ? 'secondary' :
                      user.fica_status === 'rejected' ? 'destructive' : 'outline'
                    }>
                      {user.fica_status === 'verified' ? 'Verified' :
                       user.fica_status === 'pending' ? 'Pending' :
                       user.fica_status === 'rejected' ? 'Rejected' : 'Not submitted'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.is_suspended ? (
                      <Badge variant="destructive">Suspended</Badge>
                    ) : (
                      <Badge variant="default">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : 'Never'}
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
                          setSelectedUser(user)
                          setShowUserModal(true)
                        }}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        {user.fica_status === 'pending' && (
                          <>
                            <DropdownMenuItem onClick={() => {
                              setSelectedUser(user)
                              setFicaAction('approve')
                              setShowFicaModal(true)
                            }}>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Approve FICA
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setSelectedUser(user)
                              setFicaAction('reject')
                              setShowFicaModal(true)
                            }}>
                              <XCircle className="mr-2 h-4 w-4" />
                              Reject FICA
                            </DropdownMenuItem>
                          </>
                        )}
                        {!user.is_suspended ? (
                          <DropdownMenuItem onClick={() => {
                            setSelectedUser(user)
                            setShowUserModal(true)
                          }}>
                            <UserX className="mr-2 h-4 w-4" />
                            Suspend User
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleUnsuspendUser(user.id)}>
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
        </CardContent>
      </Card>

      {/* User Details Modal */}
      <Dialog open={showUserModal} onOpenChange={setShowUserModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>View and manage user account</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Name</Label>
                  <p className="text-sm">{selectedUser.full_name || 'No name'}</p>
                </div>
                <div>
                  <Label>Email</Label>
                  <p className="text-sm">{selectedUser.email}</p>
                </div>
                <div>
                  <Label>Role</Label>
                  <p className="text-sm">{selectedUser.user_role}</p>
                </div>
                <div>
                  <Label>FICA Status</Label>
                  <p className="text-sm">{selectedUser.fica_status || 'Not submitted'}</p>
                </div>
                <div>
                  <Label>Account Status</Label>
                  <p className="text-sm">{selectedUser.is_suspended ? 'Suspended' : 'Active'}</p>
                </div>
                <div>
                  <Label>Joined</Label>
                  <p className="text-sm">{new Date(selectedUser.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              {selectedUser.fica_rejection_reason && (
                <div>
                  <Label>FICA Rejection Reason</Label>
                  <p className="text-sm text-red-600">{selectedUser.fica_rejection_reason}</p>
                </div>
              )}

              {selectedUser.suspension_reason && (
                <div>
                  <Label>Suspension Reason</Label>
                  <p className="text-sm text-red-600">{selectedUser.suspension_reason}</p>
                </div>
              )}

              {!selectedUser.is_suspended && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="suspension-reason">Suspension Reason</Label>
                    <Textarea
                      id="suspension-reason"
                      value={suspensionReason}
                      onChange={(e) => setSuspensionReason(e.target.value)}
                      placeholder="Reason for suspension..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="suspension-days">Suspension Duration (days)</Label>
                    <Input
                      id="suspension-days"
                      type="number"
                      value={suspensionDays}
                      onChange={(e) => setSuspensionDays(parseInt(e.target.value))}
                      min="1"
                      max="365"
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {ficaAction === 'approve' ? 'Approve FICA' : 'Reject FICA'}
            </DialogTitle>
            <DialogDescription>
              {ficaAction === 'approve' 
                ? 'This will verify the user\'s FICA documents and allow them to sell on the platform.'
                : 'This will reject the user\'s FICA documents. Please provide a reason.'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedUser && (
              <div>
                <Label>User</Label>
                <p className="text-sm">{selectedUser.full_name} ({selectedUser.email})</p>
              </div>
            )}
            
            {ficaAction === 'reject' && (
              <div>
                <Label htmlFor="rejection-reason">Rejection Reason</Label>
                <Textarea
                  id="rejection-reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Please provide a reason for rejection..."
                  required
                />
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowFicaModal(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleFicaAction}
                variant={ficaAction === 'approve' ? 'default' : 'destructive'}
                disabled={isProcessing || (ficaAction === 'reject' && !rejectionReason)}
              >
                {isProcessing ? 'Processing...' : ficaAction === 'approve' ? 'Approve' : 'Reject'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Audit Logs Modal */}
      <Dialog open={showAuditModal} onOpenChange={setShowAuditModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Audit Logs</DialogTitle>
            <DialogDescription>Recent FICA and user management actions</DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Performed By</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant={
                        log.action === 'approved' ? 'default' :
                        log.action === 'rejected' ? 'destructive' : 'secondary'
                      }>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>{log.user_name || 'Unknown'}</TableCell>
                    <TableCell>{log.performer_name || 'Unknown'}</TableCell>
                    <TableCell>{log.reason || '-'}</TableCell>
                    <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

