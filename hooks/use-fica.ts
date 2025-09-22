import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

export interface FicaDocument {
  id: string
  user_id: string
  document_type: 'id_document' | 'proof_of_address' | 'id_selfie'
  file_url: string
  file_name: string
  file_size?: number
  mime_type?: string
  uploaded_at: string
}

export interface FicaStatus {
  fica_status: 'pending' | 'verified' | 'rejected' | null | undefined
  fica_rejection_reason?: string
  fica_verified_at?: string | undefined
  fica_reviewed_at?: string | undefined
  user_role: 'visitor' | 'buyer' | 'seller' | 'admin' | 'support'
}

export function useFica() {
  const [documents, setDocuments] = useState<FicaDocument[]>([])
  const [ficaStatus, setFicaStatus] = useState<FicaStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const supabase = createClient()

  // Fetch FICA documents and status
  const fetchFicaData = async () => {
    try {
      setLoading(true)
      
      // Get current user first
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      
      if (!currentUser) {
        setFicaStatus({
          fica_status: undefined,
          fica_rejection_reason: '',
          fica_verified_at: undefined,
          fica_reviewed_at: undefined,
          user_role: 'visitor'
        })
        setDocuments([])
        return
      }

      // Fetch user profile with FICA status - be more specific with the query
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('fica_status, fica_rejection_reason, fica_verified_at, fica_reviewed_at, user_role')
        .eq('user_id', currentUser.id)
        .maybeSingle()

      if (profileError) {
        console.error('Profile error:', {
          code: profileError.code,
          message: profileError.message,
          details: profileError.details,
          hint: profileError.hint
        })
        // If profile doesn't exist, create a default one
        if (profileError.code === 'PGRST116') {
          // Profile doesn't exist, create it
          const { error: createError } = await supabase
            .from('user_profiles')
            .insert({
              user_id: currentUser.id,
              user_role: 'visitor',
              fica_status: null
            })
          
          if (createError) {
            console.error('Error creating profile:', createError)
          } else {
            // Retry fetching the profile after creation
            const { data: newProfile, error: retryError } = await supabase
              .from('user_profiles')
              .select('fica_status, fica_rejection_reason, fica_verified_at, fica_reviewed_at, user_role')
              .eq('user_id', currentUser.id)
              .single()
            
            if (!retryError && newProfile) {
              setFicaStatus(newProfile)
              // Continue with document fetching
              const { data: docs, error: docsError } = await supabase
                .from('fica_documents')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('uploaded_at', { ascending: false })
              
              if (!docsError) {
                setDocuments(docs || [])
              }
              return
            }
          }
        }
        
        // Use defaults
        setFicaStatus({
          fica_status: null,
          fica_rejection_reason: '',
          fica_verified_at: undefined,
          fica_reviewed_at: undefined,
          user_role: 'visitor'
        })
        setDocuments([])
        return
      }

      // Fetch FICA documents for this specific user
      const { data: docs, error: docsError } = await supabase
        .from('fica_documents')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('uploaded_at', { ascending: false })

      if (docsError) {
        console.error('Documents error:', docsError)
        // Don't throw, just use empty array
        setDocuments([])
      } else {
        setDocuments(docs || [])
      }

      // Handle case when profile doesn't exist yet
      setFicaStatus(profile || {
        fica_status: null,
        fica_rejection_reason: '',
        fica_verified_at: undefined,
        fica_reviewed_at: undefined,
        user_role: 'visitor'
      })
      setDocuments(docs || [])
    } catch (error) {
      console.error('Error fetching FICA data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Upload FICA document
  const uploadDocument = async (
    file: File,
    documentType: 'id_document' | 'proof_of_address' | 'id_selfie'
  ) => {
    try {
      setUploading(prev => ({ ...prev, [documentType]: true }))

      // Get current user
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        throw new Error('User not authenticated')
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `fica-documents/${fileName}`

      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath)

      // Save document record to database
      const { data, error: dbError } = await supabase
        .from('fica_documents')
        .upsert({
          user_id: currentUser.id,
          document_type: documentType,
          file_url: publicUrl,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
        })
        .select()
        .single()

      if (dbError) throw dbError

      // Update FICA status to pending if not already set
      if (!ficaStatus?.fica_status) {
        const { error: statusError } = await supabase
          .from('user_profiles')
          .update({ fica_status: 'pending' })
          .eq('user_id', currentUser.id)

        if (statusError) throw statusError
      }

      // Refresh data
      await fetchFicaData()
      
      return { success: true, data }
    } catch (error) {
      console.error('Error uploading document:', error)
      return { success: false, error }
    } finally {
      setUploading(prev => ({ ...prev, [documentType]: false }))
    }
  }

  // Delete FICA document
  const deleteDocument = async (documentId: string) => {
    try {
      // Prevent deletion if user is FICA verified
      if (ficaStatus?.fica_status === 'verified') {
        throw new Error('Documents cannot be removed after FICA verification')
      }

      const document = documents.find(doc => doc.id === documentId)
      if (!document) throw new Error('Document not found')

      // Delete from storage
      const filePath = document.file_url.split('/').pop()
      if (filePath) {
        await supabase.storage
          .from('documents')
          .remove([`fica-documents/${filePath}`])
      }

      // Delete from database
      const { error } = await supabase
        .from('fica_documents')
        .delete()
        .eq('id', documentId)

      if (error) throw error

      // Refresh data
      await fetchFicaData()
      
      return { success: true }
    } catch (error) {
      console.error('Error deleting document:', error)
      return { success: false, error }
    }
  }

  // Submit FICA for review
  const submitForReview = async () => {
    try {
      // Get current user
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        throw new Error('User not authenticated')
      }

      // Check if all required documents are uploaded
      const requiredTypes: ('id_document' | 'proof_of_address' | 'id_selfie')[] = ['id_document', 'proof_of_address', 'id_selfie']
      const uploadedTypes = documents.map(doc => doc.document_type)
      const missingTypes = requiredTypes.filter(type => !uploadedTypes.includes(type))

      if (missingTypes.length > 0) {
        throw new Error(`Missing required documents: ${missingTypes.join(', ')}`)
      }

      // Update status to pending
      const { error } = await supabase
        .from('user_profiles')
        .update({ fica_status: 'pending' })
        .eq('user_id', currentUser.id)

      if (error) throw error

      // Log the submission
      const { error: logError } = await supabase.rpc('log_fica_action', {
        p_user_id: currentUser.id,
        p_action: 'submitted'
      })

      if (logError) throw logError

      // Refresh data
      await fetchFicaData()
      
      return { success: true }
    } catch (error) {
      console.error('Error submitting for review:', error)
      return { success: false, error }
    }
  }

  // Check if user can publish listings
  const canPublishListings = () => {
    return ficaStatus?.user_role === 'seller' && ficaStatus?.fica_status === 'verified'
  }

  // Check if a specific document type is uploading
  const isUploading = (documentType: string) => {
    return uploading[documentType] || false
  }

  // Check if user is loan eligible
  const isLoanEligible = () => {
    return ficaStatus?.fica_status === 'verified'
  }

  useEffect(() => {
    fetchFicaData()
  }, [])

  return {
    documents,
    ficaStatus,
    loading,
    uploading,
    isUploading,
    uploadDocument,
    deleteDocument,
    submitForReview,
    canPublishListings,
    isLoanEligible,
    refetch: fetchFicaData,
  }
}
