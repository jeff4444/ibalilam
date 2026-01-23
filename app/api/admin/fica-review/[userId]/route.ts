import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { supabaseAdmin } from '@/utils/supabase/admin'
import { verifyAdmin } from '@/lib/auth-utils'
import { cookies } from 'next/headers'
import { logger } from '@/lib/logger'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Await params before accessing properties (Next.js 15 requirement)
    const { userId } = await params

    // Get user from request cookies (authenticated session)
    const supabase = await createClient(cookies())
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin status from admins table using admin client
    const adminInfo = await verifyAdmin(supabaseAdmin, user.id)
    if (!adminInfo.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch user profile with personal information using admin client
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('first_name, last_name, phone, address, user_role, fica_status, fica_rejection_reason, fica_verified_at, fica_reviewed_at, created_at')
      .eq('user_id', userId)
      .single()

    if (profileError) {
      logger.error('Error fetching user profile:', profileError)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Fetch user email from auth using admin client
    const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(userId)
    
    // Fetch shop/business information using admin client
    const { data: shop, error: shopError } = await supabaseAdmin
      .from('shops')
      .select('name, registration_number, owner_name, owner_phone, owner_email')
      .eq('user_id', userId)
      .maybeSingle()

    if (shopError) {
      logger.error('Error fetching shop data:', shopError)
    }

    // Fetch FICA documents using admin client
    const { data: documents, error: docsError } = await supabaseAdmin
      .from('fica_documents')
      .select('id, document_type, file_url, file_name, uploaded_at')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false })

    if (docsError) {
      logger.error('Error fetching FICA documents:', docsError)
    }

    // Combine all data
    const ficaDetails = {
      userId,
      personal: {
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        email: authUser?.user?.email || '',
        phone: profile.phone || '',
        address: profile.address || '',
      },
      business: {
        name: shop?.name || '',
        registrationNumber: shop?.registration_number || '',
        ownerName: shop?.owner_name || '',
        ownerPhone: shop?.owner_phone || '',
        ownerEmail: shop?.owner_email || '',
      },
      documents: documents || [],
      ficaStatus: {
        status: profile.fica_status,
        rejectionReason: profile.fica_rejection_reason,
        verifiedAt: profile.fica_verified_at,
        reviewedAt: profile.fica_reviewed_at,
      },
      userRole: profile.user_role,
      createdAt: profile.created_at,
    }

    return NextResponse.json({ data: ficaDetails })
  } catch (error) {
    logger.error('Error in FICA detail API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
