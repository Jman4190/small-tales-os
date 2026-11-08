import { NextResponse } from "next/server";
import { v4 as uuidv4 } from 'uuid';
import { logBookEvent } from "@/lib/book-logger"; // Use absolute path
import { requireAdminUser } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const admin = await requireAdminUser();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }
  const { user, supabase: supabaseAdmin } = admin;

  console.log(`[admin-approve] Authenticated admin request from user: ${user.id}`);

  const { bookId, orderId } = await request.json();
  console.log(`[admin-approve] Received request for bookId: ${bookId}, orderId: ${orderId}`);

  if (!bookId || !orderId) {
    console.error("[admin-approve] Missing bookId or orderId");
    return NextResponse.json(
      { error: "Missing required parameters: bookId and orderId" },
      { status: 400 }
    );
  }

  try {
    // 1. Fetch the latest book_approvals record for the book
    const { data: approvalData, error: approvalError } = await supabaseAdmin
      .from("book_approvals")
      .select("id, status, pdf_url") // Get ID, status, and latest PDF URL
      .eq("book_id", bookId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (approvalError || !approvalData) {
      console.error(
        `[admin-approve] Error fetching approval record for book ${bookId}:`,
        approvalError
      );
      await logBookEvent(bookId, "admin_approve_failed_fetch_approval", {
        order_id: orderId,
        error: approvalError?.message ?? "Approval record not found",
      });
      return NextResponse.json(
        { error: "Could not find approval record for this book." },
        { status: 404 }
      );
    }

    const { id: approvalId, status: currentStatus, pdf_url: latestPdfUrl } = approvalData;

    // Check if already approved
    if (currentStatus === "approved") {
      console.warn(`[admin-approve] Book ${bookId} is already approved.`);
      await logBookEvent(bookId, "admin_approve_already_approved", {
        order_id: orderId,
        approval_id: approvalId,
      });
      // Consider returning the existing data or a specific message
      // For now, let's prevent re-triggering Gelato
      return NextResponse.json(
        { message: "Book is already approved. Print job likely exists." },
        { status: 409 } // Conflict status
      );
    }

    // Check if PDF URL exists (essential for printing)
    if (!latestPdfUrl) {
        console.error(`[admin-approve] No PDF URL found in latest approval record ${approvalId} for book ${bookId}. Cannot approve.`);
        await logBookEvent(bookId, "admin_approve_failed_missing_pdf", {
            order_id: orderId,
            approval_id: approvalId,
        });
        return NextResponse.json(
            { error: "Cannot approve: Missing PDF URL in the latest approval record." },
            { status: 400 }
        );
    }

    // 2. Generate a unique print job ID
    const printJobId = `st_${uuidv4()}`;
    console.log(`[admin-approve] Generated print job ID: ${printJobId}`);

    // 3. Update approval record to approved with the print job ID
    console.log(`[admin-approve] Updating approval ${approvalId} to approved with print job ID`);
    const { data: updatedData, error: updateError } = await supabaseAdmin
      .from("book_approvals")
      .update({
        status: "approved",
        print_job_id: printJobId,
        // pdf_url should already be the latest from the regeneration
      })
      .eq("id", approvalId) // Use the specific ID of the record we fetched
      .select('id') // Select something minimal to confirm update
      .single();

    if (updateError || !updatedData) {
      console.error("[admin-approve] Update failed:", updateError);
      await logBookEvent(bookId, "admin_approve_failed_update_status", {
        approval_id: approvalId,
        order_id: orderId,
        error: updateError?.message ?? "Update returned no data",
      });
      return NextResponse.json({ error: "Approval update failed" }, { status: 500 });
    }

    console.log(`[admin-approve] Successfully updated approval status to 'approved' for ${approvalId} with print job ID: ${printJobId}`);
    await logBookEvent(bookId, "admin_approved_successfully", {
      approval_id: approvalId,
      order_id: orderId,
      print_job_id: printJobId,
    });

    // 4. Trigger Gelato order creation (adapted from /api/approve)
    try {
      const gelatoApiUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/gelato/create-order`;
      console.log(`[admin-approve] Triggering Gelato order creation at: ${gelatoApiUrl}`);
      
      await logBookEvent(bookId, "admin_approve_gelato_trigger", {
        approval_id: approvalId,
        order_id: orderId,
        print_job_id: printJobId,
      });

      // The /api/gelato/create-order route fetches necessary details using approvalId/printJobId
      const requestBody = {
        approvalId: approvalId, // Pass the specific approval ID
        printJobId: printJobId
      };
      console.log(`[admin-approve] Request body for Gelato trigger: ${JSON.stringify(requestBody)}`);

      const gelatoResponse = await fetch(gelatoApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": process.env.INTERNAL_API_SECRET!,
        },
        body: JSON.stringify(requestBody)
      });

      console.log(`[admin-approve] Gelato API response status: ${gelatoResponse.status}`);
      const responseText = await gelatoResponse.text(); // Read body once
      console.log(`[admin-approve] Gelato API response body: ${responseText}`);
      
      let gelatoData;
      try {
        gelatoData = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`[admin-approve] Failed to parse Gelato API response as JSON: ${parseError}`);
        await logBookEvent(bookId, "admin_approve_gelato_failed", {
          approval_id: approvalId,
          order_id: orderId,
          print_job_id: printJobId,
          status_code: gelatoResponse.status,
          error: "Invalid JSON response",
          response_text: responseText.substring(0, 500) // Limit length
        });
        // Continue, approval was successful even if Gelato trigger had issues
      }

      if (!gelatoResponse.ok) {
        console.error("[admin-approve] Gelato order creation failed:", gelatoData || responseText);
        await logBookEvent(bookId, "admin_approve_gelato_failed", {
          approval_id: approvalId,
          order_id: orderId,
          print_job_id: printJobId,
          status_code: gelatoResponse.status,
          error_details: gelatoData || responseText.substring(0, 500)
        });
        // Continue, approval was successful
      } else {
        console.log("[admin-approve] Gelato order creation triggered successfully:", gelatoData?.gelatoOrderId || "ID not found in response");
        await logBookEvent(bookId, "admin_approve_gelato_succeeded", {
          approval_id: approvalId,
          order_id: orderId,
          print_job_id: printJobId,
          gelato_order_id: gelatoData?.gelatoOrderId || "unknown"
        });
      }
    } catch (error: any) {
      console.error("[admin-approve] Error triggering Gelato order:", error);
      await logBookEvent(bookId, "admin_approve_gelato_exception", {
        approval_id: approvalId,
        order_id: orderId,
        print_job_id: printJobId,
        error: error.message,
        stack: error.stack,
      });
      // Continue, approval was successful
    }

    console.log("[admin-approve] Successfully approved and triggered print:", { approvalId, printJobId });
    return NextResponse.json({
      message: "Book approved by admin, print job triggered.",
      printJobId: printJobId,
      approvalId: approvalId,
    });

  } catch (error: any) {
    console.error("[admin-approve] Unhandled error:", error);
    await logBookEvent(bookId, "admin_approve_unhandled_error", {
      order_id: orderId,
      error: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      { error: "An unexpected error occurred during admin approval." },
      { status: 500 }
    );
  }
} 