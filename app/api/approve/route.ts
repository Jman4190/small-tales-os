import { supabaseSecretKey, supabaseUrl } from '@/lib/supabase-server-env'
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { v4 as uuidv4 } from 'uuid'
import { logBookEvent } from "@/lib/book-logger"
import { trackPdfApproval } from "@/lib/posthog-tracker"
import { notifyApprovalStatus, notifyOrderUpdate } from "@/lib/slack"

const supabase = createClient(supabaseUrl, supabaseSecretKey)

export async function POST(request: Request) {
  const { token } = await request.json()

  if (!token) {
    console.error("[approve] Token missing")
    return NextResponse.json({ error: "Token missing" }, { status: 400 })
  }

  // Retrieve the record by token
  const { data, error } = await supabase
    .from("book_approvals")
    .select("*")
    .eq("token", token)
    .single()

  if (error || !data) {
    console.error("[approve] Invalid token or record not found:", error)
    return NextResponse.json({ error: "Invalid token" }, { status: 404 })
  }

  // Reject tokens older than 30 days
  const tokenAge = Date.now() - new Date(data.created_at).getTime();
  if (tokenAge > 30 * 24 * 60 * 60 * 1000) {
    console.warn("[approve] Expired token used for book:", data.book_id)
    return NextResponse.json({ error: "Approval link has expired" }, { status: 410 })
  }

  // Log the approval request
  await logBookEvent(data.book_id, "book_approval_requested", {
    approval_id: data.id,
    order_id: data.order_id,
    current_status: data.status
  })

  // If already approved, return the data instead of an error
  if (data.status === "approved") {
    console.log("[approve] Already approved, returning data")
    await logBookEvent(data.book_id, "book_already_approved", {
      approval_id: data.id,
      order_id: data.order_id
    })
    return NextResponse.json({
      message: "Book already approved",
      data: data,
    })
  }

  if (data.status !== "pending") {
    console.error("[approve] Invalid status:", data.status)
    await logBookEvent(data.book_id, "book_approval_invalid_status", {
      approval_id: data.id,
      order_id: data.order_id,
      status: data.status
    })
    return NextResponse.json({ error: "Request already processed" }, { status: 400 })
  }

  // Generate a unique print job ID
  const printJobId = `st_${uuidv4()}`
  console.log(`[approve] Generated print job ID: ${printJobId}`)

  // Update approval record to approved with the print job ID
  const { data: updatedData, error: updateError } = await supabase
    .from("book_approvals")
    .update({ 
      status: "approved",
      print_job_id: printJobId
    })
    .eq("token", token)
    .select()
    .single()

  if (updateError) {
    console.error("[approve] Update failed:", updateError)
    await logBookEvent(data.book_id, "book_approval_update_failed", {
      approval_id: data.id,
      order_id: data.order_id,
      error: updateError.message
    })
    return NextResponse.json({ error: "Approval update failed" }, { status: 500 })
  }

  console.log(`[approve] Successfully updated approval status to 'approved' with print job ID: ${printJobId}`)

  // Log successful approval
  await logBookEvent(data.book_id, "book_approved_successfully", {
    approval_id: data.id,
    order_id: data.order_id,
    print_job_id: printJobId
  })

  const { data: orderData } = await supabase
    .from('orders')
    .select('customer_email, customer_name')
    .eq('id', data.order_id)
    .single();

  await trackPdfApproval({
    bookId: data.book_id,
    orderId: data.order_id,
    status: 'approved',
    customerEmail: orderData?.customer_email ?? undefined,
    customerName: orderData?.customer_name ?? undefined
  }).catch(err => console.error('Failed to track PDF approval:', err));

  await notifyApprovalStatus({
    bookId: data.book_id,
    orderId: data.order_id,
    status: 'approved',
    token,
    customerEmail: orderData?.customer_email ?? undefined,
    customerName: orderData?.customer_name ?? undefined,
  }).catch(err => console.error('Failed to send approval Slack notification:', err));

  await notifyOrderUpdate({
    orderId: data.order_id,
    bookId: data.book_id,
    message: 'PDF approved'
  }).catch(err => console.error('Failed to send order update Slack notification:', err));

  // Trigger Gelato order creation
  try {
    const gelatoApiUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/gelato/create-order`
    console.log(`[approve] Triggering Gelato order creation at: ${gelatoApiUrl}`)
    
    await logBookEvent(data.book_id, "gelato_order_creation_triggered", {
      approval_id: updatedData.id,
      order_id: data.order_id,
      print_job_id: printJobId
    })

    const requestBody = {
      approvalId: updatedData.id,
      printJobId: printJobId
    }
    console.log(`[approve] Request body: ${JSON.stringify(requestBody)}`)

    const gelatoResponse = await fetch(gelatoApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": process.env.INTERNAL_API_SECRET!,
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`[approve] Gelato API response status: ${gelatoResponse.status}`)
    
    // Get the response as text first to debug any parsing issues
    const responseText = await gelatoResponse.text()
    console.log(`[approve] Gelato API response body: ${responseText}`)
    
    // Try to parse the response as JSON
    let gelatoData
    try {
      gelatoData = JSON.parse(responseText)
    } catch (parseError) {
      console.error(`[approve] Failed to parse Gelato API response as JSON: ${parseError}`)
      await logBookEvent(data.book_id, "gelato_order_creation_request_failed", {
        approval_id: updatedData.id,
        order_id: data.order_id,
        print_job_id: printJobId,
        status_code: gelatoResponse.status,
        error: "Invalid JSON response",
        response_text: responseText.substring(0, 500) // Limit length for logging
      })
      // We continue since the approval was successful
    }

    if (!gelatoResponse.ok) {
      console.error("[approve] Gelato order creation failed:", gelatoData || responseText);
      await logBookEvent(data.book_id, "gelato_order_creation_request_failed", {
        approval_id: updatedData.id,
        order_id: data.order_id,
        print_job_id: printJobId,
        status_code: gelatoResponse.status,
        error_details: gelatoData || responseText.substring(0, 500)
      })
      // We continue since the approval was successful
    } else {
      console.log("[approve] Gelato order created:", gelatoData?.gelatoOrderId || "ID not found in response");
      await logBookEvent(data.book_id, "gelato_order_creation_request_succeeded", {
        approval_id: updatedData.id,
        order_id: data.order_id,
        print_job_id: printJobId,
        gelato_order_id: gelatoData?.gelatoOrderId || "unknown"
      })
    }
  } catch (error) {
    console.error("[approve] Error triggering Gelato order:", error);
    await logBookEvent(data.book_id, "gelato_order_creation_request_exception", {
      approval_id: updatedData.id,
      order_id: data.order_id,
      print_job_id: printJobId,
      error: error instanceof Error ? error.message : String(error)
    })
    // We continue since the approval was successful
  }

  console.log("[approve] Successfully approved:", updatedData)
  return NextResponse.json({
    message: "Book approved, print job triggered",
    status: updatedData.status,
  })
}
