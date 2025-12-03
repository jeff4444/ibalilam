import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const supabase = await createClient(cookies(), true)
    const { userId } = params

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: adminProfile, error: adminError } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .single()

    if (adminError || !adminProfile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch user profile with personal information
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('first_name, last_name, phone, address, user_role, fica_status, fica_rejection_reason, fica_verified_at, fica_reviewed_at, created_at')
      .eq('user_id', userId)
      .single()

    if (profileError) {
      console.error('Error fetching user profile:', profileError)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Fetch user email from auth
    const { data: authUser, error: authUserError } = await supabase.auth.admin.getUserById(userId)
    
    // Fetch shop/business information
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('name, registration_number, owner_name, owner_phone, owner_email')
      .eq('user_id', userId)
      .maybeSingle()

    if (shopError) {
      console.error('Error fetching shop data:', shopError)
    }

    // Fetch FICA documents
    const { data: documents, error: docsError } = await supabase
      .from('fica_documents')
      .select('id, document_type, file_url, file_name, uploaded_at')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false })

    if (docsError) {
      console.error('Error fetching FICA documents:', docsError)
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
    console.error('Error in FICA detail API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

