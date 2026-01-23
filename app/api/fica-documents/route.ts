import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { supabaseAdmin } from '@/utils/supabase/admin'
import { cookies } from 'next/headers'
import { verifyAdmin } from '@/lib/auth-utils'
import { withRateLimit } from '@/lib/rate-limit-middleware'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(cookies())
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const targetUserId = searchParams.get('user_id')

    // If no target user ID provided, use current user
    const userId = targetUserId || user.id

    // Check if user is admin or requesting their own documents
    if (userId !== user.id) {
      // Check admin status from admins table (secure - can only be modified via service_role)
      const adminInfo = await verifyAdmin(supabaseAdmin, user.id)
      if (!adminInfo.isAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Fetch FICA documents
    const { data, error } = await supabase
      .from('fica_documents')
      .select('*')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false })

    if (error) {
      console.error('Error fetching FICA documents:', error)
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error in FICA documents API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient(cookies())
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // MED-001 FIX: Add rate limiting (use file_upload category for document uploads)
    const rateLimitResponse = await withRateLimit(request, 'file_upload', user.id)
    if (rateLimitResponse) return rateLimitResponse

    const { documentType, fileUrl, fileName, fileSize, mimeType } = await request.json()

    if (!documentType || !fileUrl || !fileName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['id_document', 'proof_of_address', 'id_selfie'].includes(documentType)) {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 })
    }

    // Insert document record
    const { data, error } = await supabase
      .from('fica_documents')
      .upsert({
        document_type: documentType,
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize,
        mime_type: mimeType,
      })
      .select()
      .single()

    if (error) {
      console.error('Error inserting FICA document:', error)
      return NextResponse.json({ error: 'Failed to save document' }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error in FICA documents POST API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient(cookies())
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // MED-001 FIX: Add rate limiting
    const rateLimitResponse = await withRateLimit(request, 'api_general', user.id)
    if (rateLimitResponse) return rateLimitResponse

    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('id')

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 })
    }

    // Get document to check ownership
    const { data: document, error: fetchError } = await supabase
      .from('fica_documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (fetchError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Check if user owns the document or is admin
    if (document.user_id !== user.id) {
      // Check admin status from admins table (secure - can only be modified via service_role)
      const adminInfo = await verifyAdmin(supabaseAdmin, user.id)
      if (!adminInfo.isAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // VULN-017 FIX: Check if user is FICA verified - prevent deletion after verification
    // This provides defense-in-depth alongside the RLS policy
    const { data: userProfile, error: userProfileError } = await supabase
      .from('user_profiles')
      .select('fica_status')
      .eq('user_id', document.user_id)
      .single()

    if (userProfileError) {
      console.error('Error checking FICA status:', userProfileError)
      return NextResponse.json({ error: 'Failed to verify FICA status' }, { status: 500 })
    }

    if (userProfile?.fica_status === 'verified') {
      return NextResponse.json({ 
        error: 'Cannot delete documents after FICA verification. Contact support for assistance.' 
      }, { status: 403 })
    }

    // Delete document
    const { error: deleteError } = await supabase
      .from('fica_documents')
      .delete()
      .eq('id', documentId)

    if (deleteError) {
      console.error('Error deleting FICA document:', deleteError)
      return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in FICA documents DELETE API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Submit FICA documents for review
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient(cookies())
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // MED-001 FIX: Add rate limiting
    const rateLimitResponse = await withRateLimit(request, 'api_general', user.id)
    if (rateLimitResponse) return rateLimitResponse

    const { action } = await request.json()

    if (action !== 'submit_for_review') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Check if all required documents are uploaded
    const { data: documents, error: docsError } = await supabase
      .from('fica_documents')
      .select('document_type')
      .eq('user_id', user.id)

    if (docsError) {
      console.error('Error fetching documents:', docsError)
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
    }

    const requiredTypes = ['id_document', 'proof_of_address', 'id_selfie']
    const uploadedTypes = documents?.map(d => d.document_type) || []
    const missingTypes = requiredTypes.filter(type => !uploadedTypes.includes(type))

    if (missingTypes.length > 0) {
      return NextResponse.json({ 
        error: `Missing required documents: ${missingTypes.join(', ')}` 
      }, { status: 400 })
    }

    // Check current FICA status - don't allow resubmission if already pending or verified
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('fica_status')
      .eq('user_id', user.id)
      .single()

    if (profileError) {
      console.error('Error fetching profile:', profileError)
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
    }

    if (profile?.fica_status === 'pending') {
      return NextResponse.json({ 
        error: 'Your documents are already pending review' 
      }, { status: 400 })
    }

    if (profile?.fica_status === 'verified') {
      return NextResponse.json({ 
        error: 'Your FICA verification is already complete' 
      }, { status: 400 })
    }

    // Use admin client to update FICA status (bypasses RLS protection)
    const { error: updateError } = await supabaseAdmin
      .from('user_profiles')
      .update({ fica_status: 'pending' })
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Error updating FICA status:', updateError)
      return NextResponse.json({ error: 'Failed to submit for review' }, { status: 500 })
    }

    // Log the submission using admin client
    const { error: logError } = await supabaseAdmin
      .from('fica_audit_log')
      .insert({
        user_id: user.id,
        action: 'submitted',
        performed_by: user.id,
        reason: null
      })

    if (logError) {
      console.error('Error logging FICA submission:', logError)
      // Don't fail the request if logging fails
    }

    return NextResponse.json({ success: true, message: 'Documents submitted for review' })
  } catch (error) {
    console.error('Error in FICA documents PUT API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
