import { supabaseSecretKey, supabaseUrl } from '@/lib/supabase-server-env'
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logBookEvent } from "@/lib/book-logger";
import { notifyOrderUpdate } from '@/lib/slack';
import { verifyInternalSecret } from "@/lib/internal-auth";
import { refreshPdfUrl } from "@/lib/refresh-pdf-url";

const supabase = createClient(
  supabaseUrl,
  supabaseSecretKey
);

const GELATO_API_KEY = process.env.GELATO_API_KEY!;
const GELATO_API_URL = "https://order.gelatoapis.com/v4/orders";

// Helper function to safely stringify objects for logging
const safeStringify = (obj: any) => {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    return `[Error stringifying object: ${e}]`;
  }
};

export async function POST(request: Request) {
  if (!verifyInternalSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Verify internal API secret — this endpoint should only be called
    // by other server-side routes (e.g., /api/approve), not directly by clients.
    const internalSecret = request.headers.get('X-Internal-Secret');
    const expectedSecret = process.env.INTERNAL_API_SECRET;
    if (!expectedSecret || !internalSecret || internalSecret !== expectedSecret) {
      console.error("[gelato] Unauthorized: missing or invalid internal API secret");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Log API key presence (not the actual key)
    console.log(`[gelato] API key present: ${!!GELATO_API_KEY}`);
    if (!GELATO_API_KEY) {
      console.error("[gelato] GELATO_API_KEY environment variable is missing");
      return NextResponse.json({ error: "Gelato API key is not configured" }, { status: 500 });
    }

    const { approvalId, printJobId } = await request.json();
    
    console.log(`[gelato] Processing order creation for approval ID: ${approvalId}, print job ID: ${printJobId || 'not provided'}`);
    
    if (!approvalId) {
      console.error("[gelato] Approval ID missing");
      return NextResponse.json({ error: "Approval ID is required" }, { status: 400 });
    }

    // Fetch the book approval record
    const { data: approval, error: approvalError } = await supabase
      .from("book_approvals")
      .select("*")
      .eq("id", approvalId)
      .single();

    if (approvalError || !approval) {
      console.error("[gelato] Book approval not found:", approvalError);
      return NextResponse.json({ error: "Book approval not found" }, { status: 404 });
    }

    console.log(`[gelato] Found approval record: ${safeStringify({
      id: approval.id,
      book_id: approval.book_id,
      order_id: approval.order_id,
      status: approval.status,
      pdf_url: approval.pdf_url ? 'present' : 'missing'
    })}`);

    // Log the start of the Gelato order creation process
    await logBookEvent(approval.book_id, "gelato_order_creation_started", {
      approval_id: approvalId,
      order_id: approval.order_id,
      print_job_id: printJobId || approval.print_job_id
    });

    if (approval.status !== "approved") {
      console.error("[gelato] Book not approved yet");
      await logBookEvent(approval.book_id, "gelato_order_creation_failed", {
        reason: "Book not approved yet",
        approval_id: approvalId,
        status: approval.status
      });
      return NextResponse.json({ error: "Book not approved yet" }, { status: 400 });
    }

    // Validate PDF URL
    if (!approval.pdf_url) {
      console.error("[gelato] PDF URL is missing in the approval record");
      await logBookEvent(approval.book_id, "gelato_order_creation_failed", {
        reason: "PDF URL missing",
        approval_id: approvalId
      });
      return NextResponse.json({ error: "PDF URL is missing" }, { status: 400 });
    }

    let accessiblePdfUrl: string;
    try {
      accessiblePdfUrl = await refreshPdfUrl(approval.pdf_url, request.url, 172800);
    } catch {
      await logBookEvent(approval.book_id, "gelato_order_creation_failed", {
        reason: "Unable to obtain a fresh private PDF link", approval_id: approvalId,
      });
      return NextResponse.json({ error: "Unable to prepare the PDF for printing. Please try again." }, { status: 503 });
    }

    // Fetch the order details including new address columns and customer_name
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*, ship_line1, ship_line2, ship_city, ship_state, ship_postal, ship_country, customer_name") // Fetch new columns and name
      .eq("id", approval.order_id)
      .single();

    if (orderError || !order) {
      console.error("[gelato] Order not found:", orderError);
      await logBookEvent(approval.book_id, "gelato_order_creation_failed", {
        reason: "Order not found",
        approval_id: approvalId,
        order_id: approval.order_id,
        error: orderError?.message
      });
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    console.log(`[gelato] Found order record: ${safeStringify({
      id: order.id,
      book_id: order.book_id,
      customer_email: order.customer_email ? 'present' : 'missing',
      shipping_address: order.shipping_address ? 'present' : 'missing'
    })}`);

    // Validate necessary order fields (email, name, and new address columns)
    const requiredOrderFields = [
        'customer_email',
        'customer_name',
        'ship_line1',
        'ship_city',
        'ship_postal',
        'ship_country'
    ];
    const missingOrderFields = requiredOrderFields.filter(field => !(order as any)[field]);

    if (missingOrderFields.length > 0) {
        console.error(`[gelato] Missing required order fields: ${missingOrderFields.join(', ')} for order ID: ${order.id}`);
        await logBookEvent(approval.book_id, "gelato_order_creation_failed", {
            reason: "Incomplete order data",
            approval_id: approvalId,
            order_id: approval.order_id,
            missing_fields: missingOrderFields
        });
        return NextResponse.json({ 
            error: "Incomplete order data for shipping", 
            missing_fields: missingOrderFields 
        }, { status: 400 });
    }

    // Extract first and last name from the customer_name field
    let firstName = "";
    let lastName = "."; // Gelato requires something, use '.' as fallback
    if (order.customer_name) {
      const nameParts = order.customer_name.trim().split(/\s+/);
      firstName = nameParts[0] || "."; // Use '.' if first name is blank
      lastName = nameParts.slice(1).join(" ") || "."; // Use '.' if last name is blank
    }

    // Prepare Gelato shipping address using new columns
    const gelatoShippingAddress = {
      firstName: firstName,
      lastName: lastName,
      addressLine1: order.ship_line1,
      addressLine2: order.ship_line2 || "", // Use empty string if null
      city: order.ship_city,
      postCode: order.ship_postal,
      state: order.ship_state || "", // Use empty string if null
      country: order.ship_country,
      email: order.customer_email, // Already validated
      phone: order.phone_number || "" // Use phone from order if available (optional for Gelato)
    };

    // Create Gelato order payload
    const gelatoPayload = {
      orderType: "draft",
      orderReferenceId: approval.order_id,
      customerReferenceId: approval.book_id,
      currency: "USD",
      items: [
        {
          itemReferenceId: approval.order_id,
          productUid: "photobooks-hardcover_pf_280x280-mm-11x11-inch_pt_170-gsm-65lb-coated-silk_cl_4-4_ccl_4-4_bt_glued-left_ct_matt-lamination_prt_1-0_cpt_130-gsm-65-lb-cover-coated-silk_ver",
          pageCount: 30,
          files: [
            {
              type: "default",
              url: accessiblePdfUrl
            }
          ],
          quantity: 1
        }
      ],
      shippingAddress: gelatoShippingAddress, // Use the new address object
      shipmentMethodUid: "normal",
      metadata: [
        {
          key: "small_tales_book",
          value: "v1"
        },
        {
          key: "print_job_id",
          value: printJobId || approval.print_job_id
        }
      ]
    };

    // Log the Gelato payload (excluding sensitive data)
    console.log(`[gelato] Prepared payload: ${safeStringify({
      orderType: gelatoPayload.orderType,
      orderReferenceId: gelatoPayload.orderReferenceId,
      customerReferenceId: gelatoPayload.customerReferenceId,
      currency: gelatoPayload.currency,
      items: [{
        itemReferenceId: gelatoPayload.items[0].itemReferenceId,
        productUid: gelatoPayload.items[0].productUid,
        pageCount: gelatoPayload.items[0].pageCount,
        quantity: gelatoPayload.items[0].quantity,
        files: [{ type: 'default', url: 'present' }]
      }],
      shippingAddress: {
        country: gelatoPayload.shippingAddress.country,
        city: gelatoPayload.shippingAddress.city,
        hasRequiredFields: 'validated'
      },
      shipmentMethodUid: gelatoPayload.shipmentMethodUid,
      metadata: gelatoPayload.metadata
    })}`);

    await logBookEvent(approval.book_id, "gelato_order_payload_created", {
      order_id: approval.order_id,
      product_uid: gelatoPayload.items[0].productUid,
      shipping_country: gelatoPayload.shippingAddress.country,
      print_job_id: printJobId || approval.print_job_id
    });

    // Call Gelato API to create the order
    console.log(`[gelato] Calling Gelato API at: ${GELATO_API_URL}`);
    console.log(`[gelato] Using API key (first 4 chars): ${GELATO_API_KEY.substring(0, 4)}...`);
    
    try {
      // Log the full payload for debugging (excluding sensitive data)
      const payloadForLogging = { ...gelatoPayload };
      if (payloadForLogging.shippingAddress) {
        payloadForLogging.shippingAddress = {
          ...payloadForLogging.shippingAddress,
          // Mask personal information
          firstName: "***",
          lastName: "***",
          email: "***",
          phone: "***"
        };
      }
      console.log(`[gelato] Full payload: ${JSON.stringify(payloadForLogging)}`);
      
      const gelatoResponse = await fetch(GELATO_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": GELATO_API_KEY
        },
        body: JSON.stringify(gelatoPayload)
      });

      console.log(`[gelato] Received response with status: ${gelatoResponse.status}`);
      
      const responseText = await gelatoResponse.text();
      console.log(`[gelato] Response body: ${responseText}`);
      
      let gelatoData;
      try {
        gelatoData = JSON.parse(responseText);
      } catch (e) {
        console.error(`[gelato] Failed to parse response as JSON: ${e}`);
        await logBookEvent(approval.book_id, "gelato_order_creation_failed", {
          reason: "Invalid JSON response",
          approval_id: approvalId,
          order_id: approval.order_id,
          status_code: gelatoResponse.status,
          response_text: responseText.substring(0, 500) // Limit length for logging
        });
        return NextResponse.json({ 
          error: "Invalid response from Gelato API", 
          details: responseText.substring(0, 500)
        }, { status: 500 });
      }

      if (!gelatoResponse.ok) {
        console.error("[gelato] API error:", gelatoData);
        await logBookEvent(approval.book_id, "gelato_order_creation_failed", {
          reason: "Gelato API error",
          approval_id: approvalId,
          order_id: approval.order_id,
          status_code: gelatoResponse.status,
          error_details: gelatoData
        });
        return NextResponse.json({ error: "Gelato API error", details: gelatoData }, { status: 500 });
      }

      console.log(`[gelato] Order created successfully with ID: ${gelatoData.id}`);

      // Update the orders table with the Gelato order ID
      const { error: orderUpdateError } = await supabase
        .from("orders")
        .update({ 
          gelato_order_id: gelatoData.id 
        })
        .eq("id", approval.order_id);

      if (orderUpdateError) {
        console.error("[gelato] Failed to update orders table with Gelato order ID:", orderUpdateError);
        await logBookEvent(approval.book_id, "gelato_order_id_update_failed", {
          approval_id: approvalId,
          order_id: approval.order_id,
          gelato_order_id: gelatoData.id,
          error: orderUpdateError.message
        });
        // We don't return an error here since the Gelato order was created successfully
      } else {
        console.log(`[gelato] Successfully updated orders table with Gelato order ID: ${gelatoData.id}`);
      }

      // If we didn't receive a print job ID from the approval route,
      // update the book_approvals record with the Gelato order ID
      if (!printJobId) {
        const { error: updateError } = await supabase
          .from("book_approvals")
          .update({ 
            print_job_id: gelatoData.id 
          })
          .eq("id", approvalId);

        if (updateError) {
          console.error("[gelato] Failed to update print_job_id:", updateError);
          await logBookEvent(approval.book_id, "gelato_print_job_id_update_failed", {
            approval_id: approvalId,
            gelato_order_id: gelatoData.id,
            error: updateError.message
          });
          // We don't return an error here since the Gelato order was created successfully
        }
      }

      // Log successful order creation
      await logBookEvent(approval.book_id, "gelato_order_created_successfully", {
        approval_id: approvalId,
        order_id: approval.order_id,
        gelato_order_id: gelatoData.id,
        print_job_id: printJobId || approval.print_job_id,
        estimated_shipping_date: gelatoData.estimatedShippingDate || null
      });
      await notifyOrderUpdate({ orderId: approval.order_id, bookId: approval.book_id, message: 'Gelato print job started' })
      return NextResponse.json({
        message: "Order created successfully in Gelato",
        gelatoOrderId: gelatoData.id,
        printJobId: printJobId || approval.print_job_id,
        orderDetails: gelatoData
      });
    } catch (fetchError) {
      console.error(`[gelato] Network error calling Gelato API: ${fetchError}`);
      await logBookEvent(approval.book_id, "gelato_order_creation_failed", {
        reason: "Network error",
        approval_id: approvalId,
        order_id: approval.order_id,
        error: fetchError instanceof Error ? fetchError.message : String(fetchError)
      });
      return NextResponse.json({ 
        error: "Network error calling Gelato API", 
        details: fetchError instanceof Error ? fetchError.message : String(fetchError)
      }, { status: 500 });
    }
  } catch (error) {
    console.error("[gelato] Unexpected error:", error);
    // Try to log the error, but don't fail if we can't get book_id
    try {
      const { approvalId } = await request.json();
      if (approvalId) {
        const { data } = await supabase
          .from("book_approvals")
          .select("book_id")
          .eq("id", approvalId)
          .single();
        
        if (data?.book_id) {
          await logBookEvent(data.book_id, "gelato_order_creation_exception", {
            error: error instanceof Error ? error.message : String(error),
            approval_id: approvalId
          });
        }
      }
    } catch (logError) {
      console.error("[gelato] Failed to log error:", logError);
    }
    
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
