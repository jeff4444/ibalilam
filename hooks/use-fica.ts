import { useState, useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
  user_role: 'visitor' | 'buyer' | 'seller'
  is_admin?: boolean
}

interface FicaData {
  documents: FicaDocument[]
  ficaStatus: FicaStatus | null
}

// Query keys for cache management
export const ficaQueryKeys = {
  all: ['fica'] as const,
  data: ['fica', 'data'] as const,
}

// Default FICA status for unauthenticated users
const defaultFicaStatus: FicaStatus = {
  fica_status: undefined,
  fica_rejection_reason: '',
  fica_verified_at: undefined,
  fica_reviewed_at: undefined,
  user_role: 'visitor',
  is_admin: false
}

// Fetch function for FICA data
async function fetchFicaData(supabase: ReturnType<typeof createClient>): Promise<FicaData> {
  // Get current user first
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  
  if (!currentUser) {
    return {
      documents: [],
      ficaStatus: defaultFicaStatus
    }
  }

  // Fetch user profile with FICA status
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('fica_status, fica_rejection_reason, fica_verified_at, fica_reviewed_at, user_role, is_admin')
    .eq('user_id', currentUser.id)
    .maybeSingle()

  let ficaStatus: FicaStatus | null = null
  let documents: FicaDocument[] = []

  if (profileError) {
    console.error('Profile error:', profileError)
    
    // If profile doesn't exist, create it
    if (profileError.code === 'PGRST116') {
      const { error: createError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: currentUser.id,
          user_role: 'visitor',
          fica_status: null
        })
      
      if (!createError) {
        // Retry fetching the profile after creation
        const { data: newProfile } = await supabase
          .from('user_profiles')
          .select('fica_status, fica_rejection_reason, fica_verified_at, fica_reviewed_at, user_role, is_admin')
          .eq('user_id', currentUser.id)
          .single()
        
        if (newProfile) {
          const allowedRoles: FicaStatus['user_role'][] = ['visitor', 'buyer', 'seller']
          ficaStatus = {
            ...newProfile,
            user_role: allowedRoles.includes(newProfile.user_role as FicaStatus['user_role'])
              ? (newProfile.user_role as FicaStatus['user_role'])
              : 'visitor',
            is_admin: Boolean(newProfile.is_admin)
          }
        }
      }
    }
    
    if (!ficaStatus) {
      ficaStatus = {
        fica_status: null,
        fica_rejection_reason: '',
        fica_verified_at: undefined,
        fica_reviewed_at: undefined,
        user_role: 'visitor',
        is_admin: false
      }
    }
  } else if (profile) {
    const allowedRoles: FicaStatus['user_role'][] = ['visitor', 'buyer', 'seller']
    ficaStatus = {
      ...profile,
      user_role: allowedRoles.includes(profile.user_role as FicaStatus['user_role'])
        ? (profile.user_role as FicaStatus['user_role'])
        : 'visitor',
      is_admin: Boolean(profile.is_admin)
    }
  } else {
    ficaStatus = {
      fica_status: null,
      fica_rejection_reason: '',
      fica_verified_at: undefined,
      fica_reviewed_at: undefined,
      user_role: 'visitor',
      is_admin: false
    }
  }

  // Fetch FICA documents for this specific user
  const { data: docs, error: docsError } = await supabase
    .from('fica_documents')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('uploaded_at', { ascending: false })

  if (!docsError) {
    documents = docs || []
  }

  return {
    documents,
    ficaStatus
  }
}

export function useFica() {
  const queryClient = useQueryClient()
  const supabase = useMemo(() => createClient(), [])
  const [uploading, setUploading] = useState<Record<string, boolean>>({})

  // Query for FICA data with 5-minute stale time
  const {
    data,
    isLoading: loading,
    refetch
  } = useQuery({
    queryKey: ficaQueryKeys.data,
    queryFn: () => fetchFicaData(supabase),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes cache
  })

  const documents = data?.documents || []
  const ficaStatus = data?.ficaStatus || null

  // Upload FICA document
  const uploadDocument = useCallback(async (
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
      const { data: docData, error: dbError } = await supabase
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

      // Invalidate cache to refresh data
      queryClient.invalidateQueries({ queryKey: ficaQueryKeys.all })
      
      return { success: true, data: docData }
    } catch (error) {
      console.error('Error uploading document:', error)
      return { success: false, error }
    } finally {
      setUploading(prev => ({ ...prev, [documentType]: false }))
    }
  }, [supabase, ficaStatus, queryClient])

  // Delete FICA document
  const deleteDocument = useCallback(async (documentId: string) => {
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

      // Invalidate cache to refresh data
      queryClient.invalidateQueries({ queryKey: ficaQueryKeys.all })
      
      return { success: true }
    } catch (error) {
      console.error('Error deleting document:', error)
      return { success: false, error }
    }
  }, [supabase, ficaStatus, documents, queryClient])

  // Submit FICA for review
  const submitForReview = useCallback(async () => {
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

      // Invalidate cache to refresh data
      queryClient.invalidateQueries({ queryKey: ficaQueryKeys.all })
      
      return { success: true }
    } catch (error) {
      console.error('Error submitting for review:', error)
      return { success: false, error }
    }
  }, [supabase, documents, queryClient])

  // Check if user can publish listings
  const canPublishListings = useCallback(() => {
    return ficaStatus?.user_role === 'seller' && ficaStatus?.fica_status === 'verified'
  }, [ficaStatus])

  // Check if a specific document type is uploading
  const isUploading = useCallback((documentType: string) => {
    return uploading[documentType] || false
  }, [uploading])

  // Check if user is loan eligible
  const isLoanEligible = useCallback(() => {
    return ficaStatus?.fica_status === 'verified'
  }, [ficaStatus])

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
    refetch,
  }
}
