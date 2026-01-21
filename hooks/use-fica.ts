import { useState, useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import { fetchWithCsrf } from '@/lib/csrf-client'

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

  // Fetch user profile with FICA status (is_admin is now in separate admins table)
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('fica_status, fica_rejection_reason, fica_verified_at, fica_reviewed_at, user_role')
    .eq('user_id', currentUser.id)
    .maybeSingle()

  // Check admin status from admins table (secure - can only be modified via service_role)
  const { data: adminRecord } = await supabase
    .from('admins')
    .select('role, is_active')
    .eq('user_id', currentUser.id)
    .eq('is_active', true)
    .maybeSingle()

  const isAdmin = Boolean(adminRecord)

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
          .select('fica_status, fica_rejection_reason, fica_verified_at, fica_reviewed_at, user_role')
          .eq('user_id', currentUser.id)
          .single()
        
        if (newProfile) {
          const allowedRoles: FicaStatus['user_role'][] = ['visitor', 'buyer', 'seller']
          ficaStatus = {
            ...newProfile,
            user_role: allowedRoles.includes(newProfile.user_role as FicaStatus['user_role'])
              ? (newProfile.user_role as FicaStatus['user_role'])
              : 'visitor',
            is_admin: isAdmin
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
        is_admin: isAdmin
      }
    }
  } else if (profile) {
    const allowedRoles: FicaStatus['user_role'][] = ['visitor', 'buyer', 'seller']
    ficaStatus = {
      ...profile,
      user_role: allowedRoles.includes(profile.user_role as FicaStatus['user_role'])
        ? (profile.user_role as FicaStatus['user_role'])
        : 'visitor',
      is_admin: isAdmin
    }
  } else {
    ficaStatus = {
      fica_status: null,
      fica_rejection_reason: '',
      fica_verified_at: undefined,
      fica_reviewed_at: undefined,
      user_role: 'visitor',
      is_admin: isAdmin
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

      // Generate unique filename with user ID folder for RLS policy compliance
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `fica-documents/${currentUser.id}/${fileName}`

      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file)

      if (uploadError) {
        console.error('Storage upload error:', uploadError.message, uploadError)
        throw new Error(`Storage upload failed: ${uploadError.message}`)
      }

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

      if (dbError) {
        console.error('Database insert error:', dbError.message, dbError)
        throw new Error(`Database insert failed: ${dbError.message}`)
      }

      // Note: FICA status is only set to 'pending' when user explicitly submits for review
      // This is handled by the submitForReview function which uses the log_fica_action RPC

      // Invalidate cache to refresh data
      queryClient.invalidateQueries({ queryKey: ficaQueryKeys.all })
      
      return { success: true, data: docData }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Error uploading document:', errorMessage, error)
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

      // Delete from storage - extract path after bucket name
      // URL format: .../documents/fica-documents/{userId}/{filename}
      const urlParts = document.file_url.split('/documents/')
      if (urlParts.length > 1) {
        const storagePath = urlParts[1] // fica-documents/{userId}/{filename}
        await supabase.storage
          .from('documents')
          .remove([storagePath])
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
      // Call the API endpoint to submit for review
      // This uses the admin client on the server to bypass RLS protection
      const response = await fetchWithCsrf('/api/fica-documents', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'submit_for_review' }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit for review')
      }

      // Invalidate cache to refresh data
      queryClient.invalidateQueries({ queryKey: ficaQueryKeys.all })
      
      return { success: true }
    } catch (error) {
      console.error('Error submitting for review:', error)
      return { success: false, error }
    }
  }, [queryClient])

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
