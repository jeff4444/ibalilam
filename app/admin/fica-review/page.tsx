'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { CheckCircle, XCircle, Eye, Clock, User, FileText, MapPin, Camera, AlertCircle, Home, Shield } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface FicaReviewUser {
  id: string
  user_id: string
  first_name: string
  last_name: string
  email: string
  fica_status: 'pending' | 'verified' | 'rejected'
  fica_rejection_reason?: string
  fica_verified_at?: string
  fica_reviewed_at?: string
  user_role: string
  created_at: string
}

interface FicaDocument {
  id: string
  document_type: 'id_document' | 'proof_of_address' | 'id_selfie'
  file_url: string
  file_name: string
  uploaded_at: string
}

export default function FicaReviewPage() {
  const [users, setUsers] = useState<FicaReviewUser[]>([])
  const [selectedUser, setSelectedUser] = useState<FicaReviewUser | null>(null)
  const [userDocuments, setUserDocuments] = useState<FicaDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewing, setReviewing] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [activeTab, setActiveTab] = useState('pending')
  
  const { user } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const supabase = createClient()

  // Check if user is admin
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

        fetchUsers()
      } catch (error) {
        console.error('Error checking admin status:', error)
        router.push('/dashboard')
      }
    }

    // Only run if user is available
    if (user) {
      checkAdminStatus()
    }
  }, [user?.id]) // Only depend on user.id, not the entire user object

  const fetchUsers = async () => {
    try {
      setLoading(true)
      
      // Get user profiles with FICA status
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('*')
        .not('fica_status', 'is', null)
        .order('created_at', { ascending: false })

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError)
        throw profilesError
      }

      // Handle the case when no profiles are found (this is normal, not an error)
      if (!profiles || profiles.length === 0) {
        setUsers([])
        return
      }

      // For now, just use the profiles without email lookup to avoid auth issues
      // We can add email lookup later if needed
      const usersWithEmail = profiles.map(profile => ({
        ...profile,
        email: 'Email not available' // We'll show this for now
      }))

      setUsers(usersWithEmail)
    } catch (error) {
      console.error('Error fetching users:', error)
      // Only show error toast for actual errors, not when no users found
      if (error && typeof error === 'object' && 'message' in error) {
        toast({
          title: 'Error',
          description: 'Failed to fetch users for review.',
          variant: 'destructive',
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchUserDocuments = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('fica_documents')
        .select('*')
        .eq('user_id', userId)
        .order('uploaded_at', { ascending: false })

      if (error) throw error
      setUserDocuments(data || [])
    } catch (error) {
      console.error('Error fetching documents:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch user documents.',
        variant: 'destructive',
      })
    }
  }

  const handleReview = async (userId: string, status: 'verified' | 'rejected') => {
    try {
      setReviewing(true)
      
      const { error } = await supabase.rpc('update_fica_status', {
        p_user_id: userId,
        p_status: status,
        p_reason: status === 'rejected' ? rejectionReason : null
      })

      if (error) throw error

      toast({
        title: 'Review completed',
        description: `User FICA status updated to ${status}.`,
      })

      setSelectedUser(null)
      setRejectionReason('')
      fetchUsers()
    } catch (error) {
      console.error('Error updating FICA status:', error)
      toast({
        title: 'Error',
        description: 'Failed to update FICA status.',
        variant: 'destructive',
      })
    } finally {
      setReviewing(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return <Badge variant="default" className="bg-green-500">Verified</Badge>
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'id_document':
        return <FileText className="h-4 w-4" />
      case 'proof_of_address':
        return <MapPin className="h-4 w-4" />
      case 'id_selfie':
        return <Camera className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  const getDocumentTitle = (type: string) => {
    switch (type) {
      case 'id_document':
        return 'ID Document'
      case 'proof_of_address':
        return 'Proof of Address'
      case 'id_selfie':
        return 'ID Selfie'
      default:
        return 'Document'
    }
  }

  const filteredUsers = users.filter(user => {
    switch (activeTab) {
      case 'pending':
        return user.fica_status === 'pending'
      case 'verified':
        return user.fica_status === 'verified'
      case 'rejected':
        return user.fica_status === 'rejected'
      default:
        return true
    }
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading FICA reviews...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">FICA Review</h1>
          <p className="text-muted-foreground">
            Review and verify user FICA documents
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button asChild variant="secondary">
            <Link href="/dashboard">
              <Home className="mr-2 h-4 w-4" />
              User Dashboard
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin">
              <Shield className="mr-2 h-4 w-4" />
              Admin Dashboard
            </Link>
          </Button>
          <Button onClick={fetchUsers} variant="outline">
            Refresh
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pending ({users.filter(u => u.fica_status === 'pending').length})
          </TabsTrigger>
          <TabsTrigger value="verified" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Verified ({users.filter(u => u.fica_status === 'verified').length})
          </TabsTrigger>
          <TabsTrigger value="rejected" className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Rejected ({users.filter(u => u.fica_status === 'rejected').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {filteredUsers.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center p-8">
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No users found for this status.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredUsers.map((user) => (
                <Card key={user.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span className="font-medium">
                            {user.first_name} {user.last_name}
                          </span>
                          {getStatusBadge(user.fica_status)}
                        </div>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Role: {user.user_role} • Submitted: {new Date(user.created_at).toLocaleDateString()}
                        </p>
                        {user.fica_rejection_reason && (
                          <p className="text-xs text-red-600">
                            Rejection reason: {user.fica_rejection_reason}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedUser(user)
                                fetchUserDocuments(user.user_id)
                              }}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Review
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>FICA Review - {user.first_name} {user.last_name}</DialogTitle>
                              <DialogDescription>
                                Review the submitted FICA documents and approve or reject the verification.
                              </DialogDescription>
                            </DialogHeader>
                            
                            <div className="space-y-6">
                              {/* User Info */}
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-sm">User Information</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <Label className="text-muted-foreground">Name</Label>
                                      <p>{user.first_name} {user.last_name}</p>
                                    </div>
                                    <div>
                                      <Label className="text-muted-foreground">Email</Label>
                                      <p>{user.email}</p>
                                    </div>
                                    <div>
                                      <Label className="text-muted-foreground">Role</Label>
                                      <p className="capitalize">{user.user_role}</p>
                                    </div>
                                    <div>
                                      <Label className="text-muted-foreground">Status</Label>
                                      <div>{getStatusBadge(user.fica_status)}</div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>

                              {/* Documents */}
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-sm">Submitted Documents</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  {userDocuments.length === 0 ? (
                                    <p className="text-muted-foreground text-center py-4">
                                      No documents found for this user.
                                    </p>
                                  ) : (
                                    <div className="grid gap-4 md:grid-cols-3">
                                      {userDocuments.map((doc) => (
                                        <div key={doc.id} className="space-y-2">
                                          <div className="flex items-center gap-2">
                                            {getDocumentIcon(doc.document_type)}
                                            <span className="text-sm font-medium">
                                              {getDocumentTitle(doc.document_type)}
                                            </span>
                                          </div>
                                          <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                                            {doc.file_url.includes('.pdf') ? (
                                              <div className="flex items-center justify-center h-full">
                                                <FileText className="h-8 w-8 text-muted-foreground" />
                                              </div>
                                            ) : (
                                              <img
                                                src={doc.file_url}
                                                alt={doc.file_name}
                                                className="w-full h-full object-cover"
                                              />
                                            )}
                                          </div>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full"
                                            onClick={() => window.open(doc.file_url, '_blank')}
                                          >
                                            View Full Size
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </CardContent>
                              </Card>

                              {/* Review Actions */}
                              {user.fica_status === 'pending' && (
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="text-sm">Review Actions</CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-4">
                                    <div>
                                      <Label htmlFor="rejection-reason">Rejection Reason (if rejecting)</Label>
                                      <Textarea
                                        id="rejection-reason"
                                        placeholder="Enter reason for rejection..."
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                        className="mt-1"
                                      />
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        onClick={() => handleReview(user.user_id, 'verified')}
                                        disabled={reviewing}
                                        className="flex-1"
                                      >
                                        <CheckCircle className="h-4 w-4 mr-1" />
                                        Approve
                                      </Button>
                                      <Button
                                        variant="destructive"
                                        onClick={() => handleReview(user.user_id, 'rejected')}
                                        disabled={reviewing}
                                        className="flex-1"
                                      >
                                        <XCircle className="h-4 w-4 mr-1" />
                                        Reject
                                      </Button>
                                    </div>
                                  </CardContent>
                                </Card>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
