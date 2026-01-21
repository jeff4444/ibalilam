'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { fetchWithCsrf } from '@/lib/csrf-client'
import { 
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  FileText,
  User,
  Building2,
  IdCard,
  MapPin,
  Camera,
  Phone,
  Mail,
  Hash
} from 'lucide-react'

interface FicaDetails {
  userId: string
  personal: {
    firstName: string
    lastName: string
    email: string
    phone: string
    address: string
  }
  business: {
    name: string
    registrationNumber: string
    ownerName: string
    ownerPhone: string
    ownerEmail: string
  }
  documents: {
    id: string
    document_type: 'id_document' | 'proof_of_address' | 'id_selfie'
    file_url: string
    file_name: string
    uploaded_at: string
  }[]
  ficaStatus: {
    status: 'pending' | 'verified' | 'rejected' | null
    rejectionReason?: string
    verifiedAt?: string
    reviewedAt?: string
  }
  userRole: string
  createdAt: string
}

export default function FicaDetailPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.userId as string

  const [ficaDetails, setFicaDetails] = useState<FicaDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')

  useEffect(() => {
    fetchFicaDetails()
  }, [userId])

  const fetchFicaDetails = async () => {
    try {
      setLoading(true)
      setError('')

      const response = await fetch(`/api/admin/fica-review/${userId}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch FICA details')
      }

      setFicaDetails(result.data)
    } catch (err: any) {
      setError(err.message || 'Failed to load FICA details')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    try {
      setIsProcessing(true)
      setError('')

      const response = await fetchWithCsrf('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          action: 'approve_fica'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to approve FICA')
      }

      setSuccess('FICA verification approved successfully!')
      fetchFicaDetails()
      
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to approve FICA')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setError('Please provide a rejection reason')
      return
    }

    try {
      setIsProcessing(true)
      setError('')

      const response = await fetchWithCsrf('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          action: 'reject_fica',
          rejection_reason: rejectionReason
        })
      })

      if (!response.ok) {
        throw new Error('Failed to reject FICA')
      }

      setSuccess('FICA verification rejected')
      setShowRejectForm(false)
      setRejectionReason('')
      fetchFicaDetails()
      
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to reject FICA')
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

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'pending':
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            <Clock className="mr-1 h-3 w-3" />
            Pending Review
          </Badge>
        )
      case 'verified':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
            <CheckCircle className="mr-1 h-3 w-3" />
            Verified
          </Badge>
        )
      case 'rejected':
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <XCircle className="mr-1 h-3 w-3" />
            Rejected
          </Badge>
        )
      default:
        return (
          <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">
            Not Submitted
          </Badge>
        )
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        </div>
      </div>
    )
  }

  if (!ficaDetails) {
    return (
      <div className="p-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="py-12 text-center">
            <User className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">User not found</p>
            <Link href="/admin/fica-review">
              <Button variant="outline" className="mt-4 border-slate-700 text-slate-300">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to FICA Review
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/fica-review">
            <Button variant="outline" size="sm" className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700 hover:border-slate-500 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-white">
              FICA Review: {ficaDetails.personal.firstName} {ficaDetails.personal.lastName}
            </h1>
            <p className="text-slate-400 mt-1">
              {ficaDetails.userRole} • Submitted {new Date(ficaDetails.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge(ficaDetails.ficaStatus.status)}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-green-500/50 bg-green-500/10 text-green-400">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Personal Information */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <User className="h-5 w-5 text-blue-400" />
              Personal Information
            </CardTitle>
            <CardDescription className="text-slate-400">
              Personal details submitted for FICA verification
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-400 text-sm">First Name</Label>
                <p className="text-white font-medium">{ficaDetails.personal.firstName || '-'}</p>
              </div>
              <div>
                <Label className="text-slate-400 text-sm">Last Name</Label>
                <p className="text-white font-medium">{ficaDetails.personal.lastName || '-'}</p>
              </div>
            </div>
            <div>
              <Label className="text-slate-400 text-sm">Address</Label>
              <p className="text-white font-medium">{ficaDetails.personal.address || '-'}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-400 text-sm flex items-center gap-1">
                  <Mail className="h-3 w-3" /> Email
                </Label>
                <p className="text-white font-medium">{ficaDetails.personal.email || '-'}</p>
              </div>
              <div>
                <Label className="text-slate-400 text-sm flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Contact Number
                </Label>
                <p className="text-white font-medium">{ficaDetails.personal.phone || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Business Information */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald-400" />
              Business Information
            </CardTitle>
            <CardDescription className="text-slate-400">
              Business details submitted for FICA verification
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-400 text-sm">Business Name</Label>
                <p className="text-white font-medium">{ficaDetails.business.name || '-'}</p>
              </div>
              <div>
                <Label className="text-slate-400 text-sm flex items-center gap-1">
                  <Hash className="h-3 w-3" /> Registration Number
                </Label>
                <p className="text-white font-medium">{ficaDetails.business.registrationNumber || '-'}</p>
              </div>
            </div>
            <div>
              <Label className="text-slate-400 text-sm">Owner Name</Label>
              <p className="text-white font-medium">{ficaDetails.business.ownerName || '-'}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-400 text-sm flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Owner Phone
                </Label>
                <p className="text-white font-medium">{ficaDetails.business.ownerPhone || '-'}</p>
              </div>
              <div>
                <Label className="text-slate-400 text-sm flex items-center gap-1">
                  <Mail className="h-3 w-3" /> Owner Email
                </Label>
                <p className="text-white font-medium">{ficaDetails.business.ownerEmail || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FICA Documents */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-400" />
            FICA Documents
          </CardTitle>
          <CardDescription className="text-slate-400">
            Uploaded documents for identity verification
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ficaDetails.documents.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No documents uploaded</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {ficaDetails.documents.map((doc) => (
                <a
                  key={doc.id}
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700"
                >
                  {getDocumentIcon(doc.document_type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{getDocumentLabel(doc.document_type)}</p>
                    <p className="text-xs text-slate-500 truncate">{doc.file_name}</p>
                    <p className="text-xs text-slate-600 mt-1">
                      Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-slate-500" />
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Information */}
      {ficaDetails.ficaStatus.rejectionReason && (
        <Card className="bg-slate-900 border-red-500/30">
          <CardHeader>
            <CardTitle className="text-red-400 flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              Rejection Reason
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-white">{ficaDetails.ficaStatus.rejectionReason}</p>
            {ficaDetails.ficaStatus.reviewedAt && (
              <p className="text-slate-500 text-sm mt-2">
                Reviewed on {new Date(ficaDetails.ficaStatus.reviewedAt).toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {ficaDetails.ficaStatus.status === 'verified' && ficaDetails.ficaStatus.verifiedAt && (
        <Card className="bg-slate-900 border-emerald-500/30">
          <CardHeader>
            <CardTitle className="text-emerald-400 flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Verification Complete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-white">
              FICA verification was approved on {new Date(ficaDetails.ficaStatus.verifiedAt).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Review Actions */}
      {ficaDetails.ficaStatus.status === 'pending' && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Review Actions</CardTitle>
            <CardDescription className="text-slate-400">
              Approve or reject this FICA verification request
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {showRejectForm ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="rejection-reason" className="text-slate-400">Rejection Reason</Label>
                  <Textarea
                    id="rejection-reason"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Please provide a clear reason for rejection..."
                    className="bg-slate-800 border-slate-700 text-white mt-1"
                    rows={3}
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => { setShowRejectForm(false); setRejectionReason('') }}
                    className="border-slate-700 text-slate-300"
                    disabled={isProcessing}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleReject}
                    disabled={isProcessing || !rejectionReason.trim()}
                  >
                    {isProcessing ? 'Processing...' : 'Confirm Rejection'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <Button
                  onClick={handleApprove}
                  disabled={isProcessing}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {isProcessing ? 'Processing...' : 'Approve FICA'}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowRejectForm(true)}
                  disabled={isProcessing}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject FICA
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

