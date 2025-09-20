'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { useFica } from '@/hooks/use-fica'
import { Upload, FileText, MapPin, Camera, CheckCircle, XCircle, AlertCircle, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface FicaUploadProps {
  onComplete?: () => void
}

export function FicaUpload({ onComplete }: FicaUploadProps) {
  const { documents, ficaStatus, loading, isUploading, uploadDocument, deleteDocument, submitForReview } = useFica()
  const { toast } = useToast()
  const fileInputRefs = {
    id_document: useRef<HTMLInputElement>(null),
    proof_of_address: useRef<HTMLInputElement>(null),
    id_selfie: useRef<HTMLInputElement>(null),
  }

  const documentTypes = [
    {
      type: 'id_document' as const,
      title: 'ID Document',
      description: 'SA ID or Passport',
      icon: FileText,
      required: true,
    },
    {
      type: 'proof_of_address' as const,
      title: 'Proof of Address',
      description: 'Bank statement, utility bill, or lease (≤ 3 months)',
      icon: MapPin,
      required: true,
    },
    {
      type: 'id_selfie' as const,
      title: 'ID Selfie',
      description: 'Picture holding your ID document',
      icon: Camera,
      required: true,
    },
  ]

  const handleFileUpload = async (file: File, documentType: 'id_document' | 'proof_of_address' | 'id_selfie') => {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a JPG, PNG, or PDF file.',
        variant: 'destructive',
      })
      return
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      toast({
        title: 'File too large',
        description: 'Please upload a file smaller than 5MB.',
        variant: 'destructive',
      })
      return
    }

    const result = await uploadDocument(file, documentType)
    if (result.success) {
      toast({
        title: 'Document uploaded',
        description: 'Your document has been uploaded successfully.',
      })
    } else {
      toast({
        title: 'Upload failed',
        description: 'There was an error uploading your document. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteDocument = async (documentId: string) => {
    const result = await deleteDocument(documentId)
    if (result.success) {
      toast({
        title: 'Document deleted',
        description: 'Your document has been deleted.',
      })
    } else {
      toast({
        title: 'Delete failed',
        description: 'There was an error deleting your document. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleSubmitForReview = async () => {
    const result = await submitForReview()
    if (result.success) {
      toast({
        title: 'Submitted for review',
        description: 'Your FICA documents have been submitted for review.',
      })
      onComplete?.()
    } else {
      toast({
        title: 'Submission failed',
        description: result.error?.message || 'There was an error submitting your documents.',
        variant: 'destructive',
      })
    }
  }

  const getDocumentStatus = (documentType: string) => {
    const doc = documents.find(d => d.document_type === documentType)
    if (!doc) return 'missing'
    return 'uploaded'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'uploaded':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'missing':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <AlertCircle className="h-5 w-5 text-yellow-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'uploaded':
        return <Badge variant="default" className="bg-green-500">Uploaded</Badge>
      case 'missing':
        return <Badge variant="destructive">Missing</Badge>
      default:
        return <Badge variant="secondary">Unknown</Badge>
    }
  }

  const allDocumentsUploaded = documentTypes.every(
    type => getDocumentStatus(type.type) === 'uploaded'
  )

  const anyDocumentUploading = documentTypes.some(
    type => isUploading(type.type)
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading FICA documents...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      {ficaStatus?.fica_status && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <span>
                FICA Status: <strong className="capitalize">{ficaStatus.fica_status}</strong>
                {ficaStatus.fica_rejection_reason && (
                  <span className="text-red-600 ml-2">({ficaStatus.fica_rejection_reason})</span>
                )}
              </span>
              {ficaStatus.fica_status === 'verified' && (
                <Badge variant="default" className="bg-green-500">
                  FICA Verified
                </Badge>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Document Upload Progress</span>
          <span>{documents.length} of {documentTypes.length} uploaded</span>
        </div>
        <Progress value={(documents.length / documentTypes.length) * 100} className="h-2" />
      </div>

      {/* Document Upload Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {documentTypes.map((docType) => {
          const Icon = docType.icon
          const status = getDocumentStatus(docType.type)
          const uploadedDoc = documents.find(d => d.document_type === docType.type)

          return (
            <Card key={docType.type} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Icon className="h-5 w-5" />
                    <CardTitle className="text-sm">{docType.title}</CardTitle>
                  </div>
                  {getStatusIcon(status)}
                </div>
                <CardDescription className="text-xs">
                  {docType.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {getStatusBadge(status)}
                
                {uploadedDoc && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {uploadedDoc.file_name}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteDocument(uploadedDoc.id)}
                      disabled={ficaStatus?.fica_status === 'verified'}
                      className="w-full"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      {ficaStatus?.fica_status === 'verified' ? 'Locked' : 'Remove'}
                    </Button>
                    {ficaStatus?.fica_status === 'verified' && (
                      <p className="text-xs text-muted-foreground text-center">
                        Documents cannot be removed after verification
                      </p>
                    )}
                  </div>
                )}

                {status === 'missing' && (
                  <div className="space-y-2">
                    <input
                      ref={fileInputRefs[docType.type]}
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          handleFileUpload(file, docType.type)
                        }
                      }}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRefs[docType.type].current?.click()}
                      disabled={isUploading(docType.type)}
                      className="w-full"
                    >
                      <Upload className="h-3 w-3 mr-1" />
                      {isUploading(docType.type) ? 'Uploading...' : 'Upload'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Submit Button */}
      {allDocumentsUploaded && ficaStatus?.fica_status !== 'pending' && ficaStatus?.fica_status !== 'verified' && (
        <div className="flex justify-center">
          <Button
            onClick={handleSubmitForReview}
            disabled={anyDocumentUploading}
            className="px-8"
          >
            Submit for Review
          </Button>
        </div>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">FICA Verification Requirements</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>To become a verified seller and access loan features, you must complete FICA verification:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Upload a clear photo of your SA ID or Passport</li>
            <li>Provide proof of address (bank statement, utility bill, or lease agreement from the last 3 months)</li>
            <li>Take a selfie holding your ID document</li>
            <li>All documents will be reviewed by our admin team</li>
            <li>You'll receive notification once verification is complete</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
