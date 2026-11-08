import { supabaseSecretKey, supabaseUrl } from '@/lib/supabase-server-env'
// /app/api/refresh-signed-url/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdminUser } from '@/lib/admin-auth'
import { verifyInternalSecret } from '@/lib/internal-auth'
import {
  extractBookPhotosRelativePath,
  isAllowedBookPhotosPdfPath,
} from '@/lib/security'

const supabase = createClient(supabaseUrl, supabaseSecretKey)

export async function POST(req: Request) {
  try {
    if (!verifyInternalSecret(req)) {
      const adminCheck = await requireAdminUser()
      if (!adminCheck.ok) {
        return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
      }
    }

    const { filePath, expiresIn = 3600 } = await req.json() // Default to 1 hour if not specified

    if (!filePath) {
      return NextResponse.json({ error: 'Missing filePath' }, { status: 400 })
    }

    // Validate expiresIn is a reasonable number (between 1 hour and 7 days)
    const validExpiresIn = Math.max(3600, Math.min(604800, expiresIn))
    
    // Extract the relative path from the full URL
    const relativePath = extractBookPhotosRelativePath(filePath)

    if (!isAllowedBookPhotosPdfPath(relativePath)) {
      return NextResponse.json({ error: 'File path not allowed' }, { status: 400 })
    }

    console.log(`Creating signed URL for relative path: ${relativePath} with expiration: ${validExpiresIn} seconds`)

    // Create a new signed URL with the specified expiry
    const { data, error } = await supabase.storage
      .from('book-photos')
      .createSignedUrl(relativePath, validExpiresIn, {
        download: true
      })

    if (error) {
      console.error('Signed URL error:', error)
      return NextResponse.json({ error: 'Failed to create signed URL', details: error }, { status: 500 })
    }

    if (!data?.signedUrl) {
      return NextResponse.json({ error: 'No signed URL generated' }, { status: 500 })
    }

    return NextResponse.json({ 
      signedUrl: data.signedUrl,
      expiresAt: new Date(Date.now() + validExpiresIn * 1000).toISOString()
    }, { status: 200 })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: `Failed to refresh signed URL: ${error.message}` }, { status: 500 })
  }
}
