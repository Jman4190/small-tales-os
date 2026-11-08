import { readBoundedJsonObject, BodyLimitError } from '@/lib/request-body';
import { guardPublicRequest } from '@/lib/request-security'
import { hasBookAccess } from '@/lib/guest-access'
import { supabaseSecretKey, supabaseUrl } from '@/lib/supabase-server-env'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseSecretKey)

export async function POST(request: Request) {
  const denied = await guardPublicRequest(request, 'upload-log');
  if (denied) return denied;
  try {
    const { 
      sessionUploadAttempts, 
      remainingUploads, 
      visitorId,
      bookId,
      hitMaxLimit, 
      multipleAttempts,
      userAgent,
      timestamp
    } = await readBoundedJsonObject(request)

    if (typeof bookId !== 'string' || !hasBookAccess(request, bookId)) return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    if (typeof visitorId !== 'string' || visitorId.length > 100 || (userAgent && (typeof userAgent !== 'string' || userAgent.length > 500)) || !Number.isInteger(sessionUploadAttempts) || sessionUploadAttempts > 100 || !Number.isInteger(remainingUploads)) return NextResponse.json({ error: 'Invalid log data' }, { status: 400 });
    // Validate required fields
    if (!visitorId) {
      console.error('Missing required field: visitorId')
      return NextResponse.json({ success: false, error: 'Missing required field: visitorId' }, { status: 400 })
    }

    if (typeof sessionUploadAttempts !== 'number' || sessionUploadAttempts < 1) {
      console.error('Invalid sessionUploadAttempts:', sessionUploadAttempts)
      return NextResponse.json({ success: false, error: 'Invalid sessionUploadAttempts' }, { status: 400 })
    }

    if (typeof remainingUploads !== 'number') {
      console.error('Invalid remainingUploads:', remainingUploads)
      return NextResponse.json({ success: false, error: 'Invalid remainingUploads' }, { status: 400 })
    }

    // Get IP address (with privacy considerations)
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    // For privacy, hash or partially mask the IP
    const maskedIp = ip.split('.').slice(0, 3).join('.') + '.xxx'

    // Prepare log data
    const logData = {
      visitor_id: visitorId,
      book_id: bookId,
      session_upload_attempts: sessionUploadAttempts,
      remaining_uploads: remainingUploads,
      hit_max_limit: hitMaxLimit,
      multiple_attempts: multipleAttempts,
      user_agent: userAgent,
      ip_partial: maskedIp,
      timestamp: timestamp || new Date().toISOString()
    }

    console.log("Logging successful book creation with upload stats:", {
      visitorId,
      bookId: bookId || 'No book ID yet',
      sessionUploadAttempts,
      remainingUploads,
      hitMaxLimit,
      multipleAttempts
    })

    // Insert log into Supabase
    const { data, error } = await supabase
      .from('upload_attempt_logs')
      .insert([logData])

    if (error) {
      console.error('Error logging upload attempt:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    console.log('Successfully logged upload attempt for visitor:', visitorId)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof BodyLimitError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in log-upload-attempt API:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to log upload attempt' },
      { status: 500 }
    )
  }
} 