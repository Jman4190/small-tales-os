import { supabaseSecretKey, supabaseUrl } from '@/lib/supabase-server-env'
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { inngest } from "@/inngest/client"; // Use absolute path for consistency
import { logBookEvent } from "@/lib/book-logger"; // Use absolute path
import { requireAdminUser } from "@/lib/admin-auth";

const supabase = createClient(supabaseUrl, supabaseSecretKey);

export async function POST(request: Request) {
  const adminCheck = await requireAdminUser();
  if (!adminCheck.ok) {
    return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
  }

  const { bookId, orderId } = await request.json();
  console.log(`[resend-approval] Received request for bookId: ${bookId}, orderId: ${orderId}`);

  if (!bookId || !orderId) {
    console.error("[resend-approval] Missing bookId or orderId");
    return NextResponse.json(
      { error: "Missing required parameters: bookId and orderId" },
      { status: 400 }
    );
  }

  try {
    // 1. Fetch the book_approvals record to get the token and current status
    const { data: approvalData, error: approvalError } = await supabase
      .from("book_approvals")
      .select("id, token, status, user_email") // Include user_email if available, otherwise fetch separately
      .eq("book_id", bookId)
      // .eq("order_id", orderId) // Usually book_id is unique enough, but orderId adds safety
      .order("created_at", { ascending: false }) // Get the latest approval record if multiple exist
      .limit(1)
      .single(); // Expect one record for the book

    if (approvalError || !approvalData) {
      console.error(
        `[resend-approval] Error fetching approval record for book ${bookId}:`,
        approvalError
      );
      await logBookEvent(bookId, "resend_approval_failed_fetch_approval", {
        order_id: orderId,
        error: approvalError?.message ?? "Approval record not found",
      });
      return NextResponse.json(
        { error: "Could not find approval record for this book." },
        { status: 404 }
      );
    }

    const { id: approvalId, token, status: currentStatus } = approvalData;
    let userEmail = approvalData.user_email;

    // Log the initial state
    await logBookEvent(bookId, "resend_approval_request_received", {
      order_id: orderId,
      approval_id: approvalId,
      current_status: currentStatus,
    });

    // Optional: Add check if already pending?
    if (currentStatus === "pending") {
       console.warn(`[resend-approval] Book ${bookId} is already pending approval.`);
       // Decide: resend anyway or return a message?
       // Let's resend for simplicity, but log it.
       await logBookEvent(bookId, "resend_approval_triggered_while_pending", {
          order_id: orderId,
          approval_id: approvalId,
       });
    }

    // 2. Fetch customer email from orders table if not in book_approvals
    if (!userEmail) {
      console.log(`[resend-approval] Fetching user email from orders table for order ${orderId}`);
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("customer_email")
        .eq("id", orderId)
        .single();

      if (orderError || !orderData?.customer_email) {
        console.error(
          `[resend-approval] Error fetching customer email for order ${orderId}:`,
          orderError
        );
        await logBookEvent(bookId, "resend_approval_failed_fetch_email", {
          order_id: orderId,
          approval_id: approvalId,
          error: orderError?.message ?? "Customer email not found in order",
        });
        return NextResponse.json(
          { error: "Could not find customer email for this order." },
          { status: 404 }
        );
      }
      userEmail = orderData.customer_email;
    }

    // 3. Update book_approvals status to 'pending'
    console.log(`[resend-approval] Updating approval status to 'pending' for approvalId: ${approvalId}`);
    const { error: updateError } = await supabase
      .from("book_approvals")
      .update({ status: "pending" })
      .eq("id", approvalId);

    if (updateError) {
      console.error(
        `[resend-approval] Failed to update approval status for ${approvalId}:`,
        updateError
      );
      await logBookEvent(bookId, "resend_approval_failed_update_status", {
        order_id: orderId,
        approval_id: approvalId,
        error: updateError.message,
      });
      return NextResponse.json(
        { error: "Failed to reset approval status." },
        { status: 500 }
      );
    }

    console.log(`[resend-approval] Approval status updated successfully for ${approvalId}`);
    await logBookEvent(bookId, "resend_approval_status_reset", {
      order_id: orderId,
      approval_id: approvalId,
    });

    // 4. Trigger the Inngest event
    console.log(`[resend-approval] Triggering Inngest event 'book/preview.email.resend.requested' for book ${bookId}`);
    await inngest.send({
      name: "book/preview.email.resend.requested",
      data: {
        userEmail: userEmail!,
        token: token,
        orderId: orderId,
        bookId: bookId,
      },
    });

    console.log(`[resend-approval] Inngest event triggered successfully for book ${bookId}`);
    await logBookEvent(bookId, "resend_approval_inngest_event_triggered", {
      order_id: orderId,
      approval_id: approvalId,
      user_email: userEmail,
    });

    return NextResponse.json({
      message: "Approval status reset and preview email queued for resend.",
    });

  } catch (error: any) {
    console.error("[resend-approval] Unhandled error:", error);
    await logBookEvent(bookId, "resend_approval_unhandled_error", {
      order_id: orderId,
      error: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
} 
