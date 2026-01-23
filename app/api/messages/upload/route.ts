import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { 
  validateFileUpload, 
  generateSecureFilename,
  ALLOWED_IMAGE_MIME_TYPES 
} from '@/lib/file-security'
import { withRateLimit } from '@/lib/rate-limit-middleware'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient(cookies())
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // MED-001 FIX: Add rate limiting (use file_upload category)
    const rateLimitResponse = await withRateLimit(request, 'file_upload', user.id)
    if (rateLimitResponse) return rateLimitResponse

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // VULN-018 FIX: Use secure file validation
    const maxSize = 5 * 1024 * 1024 // 5MB
    const validation = validateFileUpload(
      { name: file.name, type: file.type, size: file.size },
      maxSize
    )

    if (!validation.valid || !validation.extension) {
      return NextResponse.json({ error: validation.error || 'Invalid file' }, { status: 400 })
    }

    // VULN-018 FIX: Generate secure filename (prevents path traversal)
    const fileName = generateSecureFilename(user.id, validation.extension)

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('message-attachments')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.error('Error uploading file:', error)
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('message-attachments')
      .getPublicUrl(fileName)

    return NextResponse.json({ 
      url: urlData.publicUrl,
      fileName: data.path
    })
  } catch (error) {
    console.error('Error in POST /api/messages/upload:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
