import { supabaseSecretKey, supabaseUrl } from '@/lib/supabase-server-env'
import { NextResponse } from 'next/server'
import { notifyApprovalStatus, notifyOrderUpdate } from '@/lib/slack'
import { createClient } from '@supabase/supabase-js'
import { verifyInternalSecret } from '@/lib/internal-auth'

const supabase = createClient(
  supabaseUrl,
  supabaseSecretKey
)

export async function POST(request: Request) {
  if (!verifyInternalSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const data = await request.json()
    
    // Fetch book approval data from Supabase
    const { data: approval } = await supabase
      .from("book_approvals")
      .select("book_id, order_id, user_email")
      .eq("token", data.token)
      .single()

    await notifyApprovalStatus({
      bookId: approval?.book_id || 'unknown',
      orderId: approval?.order_id || 'unknown',
      status: data.status,
      declineReason: data.declineReason,
      pdfUrl: data.pdfUrl,
      token: data.token,
      customerEmail: approval?.user_email || 'Not provided',
      customerName: 'Not provided' // We don't have this data
    })

    if (approval?.order_id && approval?.book_id) {
      const statusMessage = data.status === 'approved' ? 'PDF approved' : 'PDF declined'
      await notifyOrderUpdate({ orderId: approval.order_id, bookId: approval.book_id, message: statusMessage })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error sending approval notification:', error)
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 })
  }
} 
