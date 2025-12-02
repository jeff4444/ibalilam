'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/utils/supabase/client'
import { 
  FileCheck,
  Search, 
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  ExternalLink,
  FileText,
  User,
  IdCard,
  MapPin,
  Camera
} from 'lucide-react'

interface FicaUser {
  id: string
  full_name: string
  user_role: string
  fica_status: 'pending' | 'verified' | 'rejected' | null
  fica_rejection_reason?: string
  fica_verified_at?: string
  fica_reviewed_at?: string
  created_at: string
  documents?: FicaDocument[]
}

interface FicaDocument {
  id: string
  document_type: 'id_document' | 'proof_of_address' | 'id_selfie'
  file_url: string
  file_name: string
  uploaded_at: string
}

export default function FicaReviewPage() {
  const searchParams = useSearchParams()
  const initialStatus = searchParams.get('status') || 'pending'
  
  const [users, setUsers] = useState<FicaUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState(initialStatus)
  const [selectedUser, setSelectedUser] = useState<FicaUser | null>(null)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve')
  const [rejectionReason, setRejectionReason] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [statusCounts, setStatusCounts] = useState({ pending: 0, verified: 0, rejected: 0 })
  
  const supabase = createClient()

  useEffect(() => {
    fetchStatusCounts()
  }, [])

  useEffect(() => {
    fetchFicaUsers()
  }, [searchTerm, statusFilter])

  const fetchStatusCounts = async () => {
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('fica_status')
        .not('fica_status', 'is', null)
      
      if (data) {
        setStatusCounts({
          pending: data.filter(u => u.fica_status === 'pending').length,
          verified: data.filter(u => u.fica_status === 'verified').length,
          rejected: data.filter(u => u.fica_status === 'rejected').length
        })
      }
    } catch (error) {
      console.error('Error fetching status counts:', error)
    }
  }

  const fetchFicaUsers = async () => {
    try {
      setLoading(true)
      
      // Fetch users with FICA status
      let query = supabase
        .from('user_profiles')
        .select('*')
        .not('fica_status', 'is', null)

      if (statusFilter !== 'all') {
        query = query.eq('fica_status', statusFilter)
      }

      if (searchTerm) {
        query = query.or(`full_name.ilike.%${searchTerm}%,first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%`)
      }

      query = query.order('created_at', { ascending: false })

      const { data: profiles, error } = await query

      if (error) throw error

      // Fetch FICA documents for each user
      const usersWithDocs = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: documents } = await supabase
            .from('fica_documents')
            .select('*')
            .eq('user_id', profile.user_id)

          return {
            id: profile.user_id,
            full_name: profile.full_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'No name',
            user_role: profile.user_role,
            fica_status: profile.fica_status,
            fica_rejection_reason: profile.fica_rejection_reason,
            fica_verified_at: profile.fica_verified_at,
            fica_reviewed_at: profile.fica_reviewed_at,
            created_at: profile.created_at,
            documents: documents || []
          }
        })
      )

      setUsers(usersWithDocs)
    } catch (error) {
      console.error('Error fetching FICA users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReviewAction = async () => {
    if (!selectedUser) return

    try {
      setIsProcessing(true)

      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedUser.id,
          action: reviewAction === 'approve' ? 'approve_fica' : 'reject_fica',
          rejection_reason: rejectionReason
        })
      })

      if (response.ok) {
        setShowReviewModal(false)
        setSelectedUser(null)
        setRejectionReason('')
        fetchFicaUsers()
        fetchStatusCounts()
      }
    } catch (error) {
      console.error('Error processing FICA action:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'id_document':
        return <IdCard className="h-5 w-5 text-blue-400" />
      case 'proof_of_address':
        return <MapPin className="h-5 w-5 text-green-400" />
      case 'id_selfie':
        return <Camera className="h-5 w-5 text-purple-400" />
      default:
        return <FileText className="h-5 w-5 text-slate-400" />
    }
  }

  const getDocumentLabel = (type: string) => {
    switch (type) {
      case 'id_document':
        return 'ID Document'
      case 'proof_of_address':
        return 'Proof of Address'
      case 'id_selfie':
        return 'ID Selfie'
      default:
        return type
    }
  }

  const pendingCount = statusCounts.pending
  const verifiedCount = statusCounts.verified
  const rejectedCount = statusCounts.rejected

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">FICA Review</h1>
          <p className="text-slate-400 mt-1">Review and verify user FICA documents</p>
        </div>
        <Button onClick={fetchFicaUsers} variant="outline" className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700 hover:border-slate-500 hover:text-white">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card 
          className={`bg-slate-900 border-slate-800 cursor-pointer transition-all hover:border-yellow-500/50 ${statusFilter === 'pending' ? 'border-yellow-500' : ''}`}
          onClick={() => setStatusFilter('pending')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Clock className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold text-white">{pendingCount}</p>
                <p className="text-sm text-slate-400">Pending Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`bg-slate-900 border-slate-800 cursor-pointer transition-all hover:border-emerald-500/50 ${statusFilter === 'verified' ? 'border-emerald-500' : ''}`}
          onClick={() => setStatusFilter('verified')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <CheckCircle className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold text-white">{verifiedCount}</p>
                <p className="text-sm text-slate-400">Verified</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`bg-slate-900 border-slate-800 cursor-pointer transition-all hover:border-red-500/50 ${statusFilter === 'rejected' ? 'border-red-500' : ''}`}
          onClick={() => setStatusFilter('rejected')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <XCircle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold text-white">{rejectedCount}</p>
                <p className="text-sm text-slate-400">Rejected</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48 bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* FICA Submissions */}
      <div className="grid gap-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        ) : users.length === 0 ? (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="py-12 text-center">
              <FileCheck className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No FICA submissions found</p>
            </CardContent>
          </Card>
        ) : (
          users.map((user) => (
            <Card key={user.id} className="bg-slate-900 border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-full bg-slate-800 flex items-center justify-center">
                      <User className="h-6 w-6 text-slate-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{user.full_name}</h3>
                      <p className="text-sm text-slate-400">{user.user_role} • Submitted {new Date(user.created_at).toLocaleDateString()}</p>
                      <div className="flex items-center gap-2 mt-2">
                        {user.fica_status === 'pending' && (
                          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pending Review</Badge>
                        )}
                        {user.fica_status === 'verified' && (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Verified</Badge>
                        )}
                        {user.fica_status === 'rejected' && (
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Rejected</Badge>
                        )}
                      </div>
                      {user.fica_rejection_reason && (
                        <p className="text-sm text-red-400 mt-2">Reason: {user.fica_rejection_reason}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setSelectedUser(user); setShowReviewModal(true) }}
                      className="border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Review
                    </Button>
                    {user.fica_status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => { setSelectedUser(user); setReviewAction('approve'); setShowReviewModal(true) }}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => { setSelectedUser(user); setReviewAction('reject'); setShowReviewModal(true) }}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Documents */}
                {user.documents && user.documents.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-800">
                    <p className="text-sm text-slate-400 mb-3">Submitted Documents</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {user.documents.map((doc) => (
                        <a
                          key={doc.id}
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
                        >
                          {getDocumentIcon(doc.document_type)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{getDocumentLabel(doc.document_type)}</p>
                            <p className="text-xs text-slate-500 truncate">{doc.file_name}</p>
                          </div>
                          <ExternalLink className="h-4 w-4 text-slate-500" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Review Modal */}
      <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>FICA Review - {selectedUser?.full_name}</DialogTitle>
            <DialogDescription className="text-slate-400">
              Review submitted documents and make a decision
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              {/* User Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-400">Name</Label>
                  <p className="text-white">{selectedUser.full_name}</p>
                </div>
                <div>
                  <Label className="text-slate-400">Role</Label>
                  <p className="text-white">{selectedUser.user_role}</p>
                </div>
                <div>
                  <Label className="text-slate-400">Current Status</Label>
                  <p className="text-white capitalize">{selectedUser.fica_status}</p>
                </div>
                <div>
                  <Label className="text-slate-400">Submitted</Label>
                  <p className="text-white">{new Date(selectedUser.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Documents */}
              {selectedUser.documents && selectedUser.documents.length > 0 && (
                <div>
                  <Label className="text-slate-400">Documents</Label>
                  <div className="grid gap-2 mt-2">
                    {selectedUser.documents.map((doc) => (
                      <a
                        key={doc.id}
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
                      >
                        {getDocumentIcon(doc.document_type)}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">{getDocumentLabel(doc.document_type)}</p>
                          <p className="text-xs text-slate-500">{doc.file_name}</p>
                        </div>
                        <ExternalLink className="h-4 w-4 text-slate-500" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Selection */}
              {selectedUser.fica_status === 'pending' && (
                <div className="space-y-4 pt-4 border-t border-slate-800">
                  <div className="flex gap-4">
                    <Button
                      variant={reviewAction === 'approve' ? 'default' : 'outline'}
                      onClick={() => setReviewAction('approve')}
                      className={reviewAction === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'border-slate-700 text-slate-300'}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      variant={reviewAction === 'reject' ? 'destructive' : 'outline'}
                      onClick={() => setReviewAction('reject')}
                      className={reviewAction !== 'reject' ? 'border-slate-700 text-slate-300' : ''}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                  </div>

                  {reviewAction === 'reject' && (
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

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowReviewModal(false)} className="border-slate-700 text-slate-300">
                      Cancel
                    </Button>
                    <Button
                      onClick={handleReviewAction}
                      disabled={isProcessing || (reviewAction === 'reject' && !rejectionReason)}
                      className={reviewAction === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                      variant={reviewAction === 'reject' ? 'destructive' : 'default'}
                    >
                      {isProcessing ? 'Processing...' : reviewAction === 'approve' ? 'Approve FICA' : 'Reject FICA'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
