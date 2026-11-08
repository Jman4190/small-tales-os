import { supabaseSecretKey, supabaseUrl } from '@/lib/supabase-server-env'
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { notifyApprovalStatus, notifyOrderUpdate } from "@/lib/slack"

const supabase = createClient(
  supabaseUrl, 
  supabaseSecretKey
)

export async function POST(request: Request) {
  const { token, decline_reason } = await request.json()

  if (!token) {
    console.error("[decline] Token missing")
    return NextResponse.json({ error: "Token missing" }, { status: 400 })
  }

  if (!decline_reason) {
    console.error("[decline] Decline reason missing")
    return NextResponse.json({ error: "Decline reason missing" }, { status: 400 })
  }

  // Retrieve the record by token
  const { data, error } = await supabase
    .from("book_approvals")
    .select("*")
    .eq("token", token)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 })
  }

  // Reject tokens older than 30 days
  const tokenAge = Date.now() - new Date(data.created_at).getTime();
  if (tokenAge > 30 * 24 * 60 * 60 * 1000) {
    console.warn("[decline] Expired token used for book:", data.book_id)
    return NextResponse.json({ error: "Decline link has expired" }, { status: 410 })
  }

  if (data.status !== "pending") {
    return NextResponse.json({ error: "Request already processed" }, { status: 400 })
  }

  // Update approval record to declined and store the decline reason
  const { data: updatedData, error: updateError } = await supabase
    .from("book_approvals")
    .update({ status: "declined", decline_reason })
    .eq("token", token)
    .select("status")
    .single()

  if (updateError) {
    console.error("[decline] Update failed:", updateError)
    return NextResponse.json({ error: "Decline update failed" }, { status: 500 })
  }

  // TODO: Cancel any scheduled print job with Gelato if applicable
  // TODO: Use Resend to email support with the decline details

  const { data: orderData } = await supabase
    .from('orders')
    .select('customer_email, customer_name')
    .eq('id', data.order_id)
    .single();

  await notifyApprovalStatus({
    bookId: data.book_id,
    orderId: data.order_id,
    status: 'declined',
    declineReason: decline_reason,
    token,
    customerEmail: orderData?.customer_email ?? undefined,
    customerName: orderData?.customer_name ?? undefined,
  }).catch(err => console.error('Failed to send decline Slack notification:', err));

  await notifyOrderUpdate({
    orderId: data.order_id,
    bookId: data.book_id,
    message: 'PDF declined'
  }).catch(err => console.error('Failed to send order update Slack notification:', err));

  return NextResponse.json({
    message: "Book declined, reason saved",
    status: updatedData.status,
  })
}
