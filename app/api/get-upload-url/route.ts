import { guardPublicRequest } from '@/lib/request-security'
import { grantAccess } from '@/lib/guest-access'
import { supabaseSecretKey, supabaseUrl } from '@/lib/supabase-server-env'
// /app/api/get-upload-url/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(supabaseUrl, supabaseSecretKey)

// Whitelist of allowed MIME types for photo uploads
const ALLOWED_FILE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

export async function GET(request: Request) {
  const denied = await guardPublicRequest(request, 'get-upload-url');
  if (denied) return denied;
  try {
    const { searchParams } = new URL(request.url)
    const fileType = searchParams.get('fileType')

    if (!fileType) {
      console.error('File type is missing')
      return NextResponse.json({ error: 'File type is required' }, { status: 400 })
    }

    // Validate file type against whitelist to prevent path traversal
    // and uploading of non-image files
    const extension = ALLOWED_FILE_TYPES[fileType.toLowerCase()]
    if (!extension) {
      console.error('Invalid file type:', fileType)
      return NextResponse.json({ error: 'File type not allowed. Accepted: JPEG, PNG, WebP, HEIC' }, { status: 400 })
    }

    const fileName = `${crypto.randomUUID()}.${extension}`
    const filePath = `uploads/${fileName}`

    // Only create upload URL, not view URL (since file doesn't exist yet)
    const { data, error } = await supabase.storage
      .from('book-photos')
      .createSignedUploadUrl(filePath)

    if (error) {
      console.error('Error creating signed URL:', error)
      return NextResponse.json({ error: 'Failed to create signed URL' }, { status: 500 })
    }

    return grantAccess(NextResponse.json({ url: data.signedUrl, filePath: data.path }), 'upload', data.path)
  } catch (error: any) {
    console.error('Unexpected error in get-upload-url:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

