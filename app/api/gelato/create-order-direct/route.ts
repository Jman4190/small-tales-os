import { supabaseSecretKey, supabaseUrl } from '@/lib/supabase-server-env'
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js"; // Still needed for logging
import { logBookEvent } from "@/lib/book-logger";
import { verifyInternalSecret } from "@/lib/internal-auth";

// Initialize Supabase for logging ONLY
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

// Interface for the expected request body
interface CreateOrderDirectBody {
  bookId: string;
  orderId: string;
  approvalId: string;
  printJobId: string;
  pdfUrl: string; // Expecting a valid, accessible URL
  customerEmail: string;
  shippingAddress: { // Expecting a parsed object
    firstName: string;
    lastName: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    postCode: string;
    state?: string;
    country: string;
    phone?: string;
  };
}

export async function POST(request: Request) {
  if (!verifyInternalSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log(`[gelato-direct] Received request.`);
    // Log API key presence
    if (!GELATO_API_KEY) {
      console.error("[gelato-direct] GELATO_API_KEY environment variable is missing");
      return NextResponse.json({ error: "Gelato API key is not configured" }, { status: 500 });
    }

    // --- Get data directly from request body --- 
    const body: CreateOrderDirectBody = await request.json();
    const {
      bookId,
      orderId,
      approvalId,
      printJobId,
      pdfUrl,
      customerEmail,
      shippingAddress // Already an object
    } = body;

    console.log(`[gelato-direct] Processing order: orderId=${orderId}, bookId=${bookId}, approvalId=${approvalId}, printJobId=${printJobId}`);

    // --- Basic validation of incoming data --- 
    if (!bookId || !orderId || !approvalId || !printJobId || !pdfUrl || !customerEmail || !shippingAddress) {
      console.error("[gelato-direct] Missing required fields in request body:", body);
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    // Validate required shipping address fields
    const requiredShippingFields = ['firstName', 'lastName', 'addressLine1', 'city', 'postCode', 'country'];
    const missingShippingFields = requiredShippingFields.filter(field => !(shippingAddress as any)[field]);

    if (missingShippingFields.length > 0) {
      console.error(`[gelato-direct] Missing required shipping address fields: ${missingShippingFields.join(', ')}`, shippingAddress);
       // Log failure (using Supabase client)
       await logBookEvent(bookId, "gelato_order_creation_direct_failed", {
        reason: "Incomplete shipping address provided",
        approval_id: approvalId,
        order_id: orderId,
        missing_fields: missingShippingFields
      });
      return NextResponse.json({ 
        error: "Incomplete shipping address provided", 
        missing_fields: missingShippingFields 
      }, { status: 400 });
    }
    
    // Log the start of the Gelato order creation process
    await logBookEvent(bookId, "gelato_order_creation_direct_started", {
      approval_id: approvalId,
      order_id: orderId,
      print_job_id: printJobId
    });

    // --- Construct Gelato Payload directly --- 
    const gelatoPayload = {
      orderType: "draft",
      orderReferenceId: orderId,
      customerReferenceId: bookId,
      currency: "USD",
      items: [
        {
          itemReferenceId: orderId,
          productUid: "photobooks-hardcover_pf_280x280-mm-11x11-inch_pt_170-gsm-65lb-coated-silk_cl_4-4_ccl_4-4_bt_glued-left_ct_matt-lamination_prt_1-0_cpt_130-gsm-65-lb-cover-coated-silk_ver",
          pageCount: 30,
          files: [
            {
              type: "default",
              url: pdfUrl // Use the URL passed in the request body
            }
          ],
          quantity: 1
        }
      ],
      shippingAddress: {
        firstName: shippingAddress.firstName,
        lastName: shippingAddress.lastName,
        addressLine1: shippingAddress.addressLine1,
        addressLine2: shippingAddress.addressLine2 || "",
        city: shippingAddress.city,
        postCode: shippingAddress.postCode,
        state: shippingAddress.state || "",
        country: shippingAddress.country,
        email: customerEmail, // Use email from request body
        phone: shippingAddress.phone || ""
      },
      shipmentMethodUid: "normal",
      metadata: [
        {
          key: "small_tales_book",
          value: "v1"
        },
        {
          key: "print_job_id",
          value: printJobId 
        }
      ]
    };

    // Log the Gelato payload (excluding sensitive data)
    console.log(`[gelato-direct] Prepared payload: ${safeStringify({
      // ... (similar logging as original route) ...
      shippingAddress: { country: shippingAddress.country, city: shippingAddress.city, hasRequiredFields: 'validated' }
    })}`);

    await logBookEvent(bookId, "gelato_order_payload_direct_created", {
      order_id: orderId,
      product_uid: gelatoPayload.items[0].productUid,
      shipping_country: shippingAddress.country,
      print_job_id: printJobId
    });

    // --- Call Gelato API --- 
    console.log(`[gelato-direct] Calling Gelato API at: ${GELATO_API_URL}`);
    
    try {
      // ... (Payload logging with masking, same as original) ...
      const payloadForLogging = { ...gelatoPayload };
      if (payloadForLogging.shippingAddress) {
        payloadForLogging.shippingAddress = {
          ...payloadForLogging.shippingAddress,
          firstName: "***", lastName: "***", email: "***", phone: "***"
        };
      }
      console.log(`[gelato-direct] Full payload: ${JSON.stringify(payloadForLogging)}`);
      
      const gelatoResponse = await fetch(GELATO_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": GELATO_API_KEY
        },
        body: JSON.stringify(gelatoPayload)
      });

      console.log(`[gelato-direct] Received response with status: ${gelatoResponse.status}`);
      
      const responseText = await gelatoResponse.text();
      console.log(`[gelato-direct] Response body: ${responseText}`);
      
      let gelatoData;
      try {
        gelatoData = JSON.parse(responseText);
      } catch (e) {
        console.error(`[gelato-direct] Failed to parse response as JSON: ${e}`);
        await logBookEvent(bookId, "gelato_order_creation_direct_failed", {
          reason: "Invalid JSON response from Gelato",
          approval_id: approvalId,
          order_id: orderId,
          status_code: gelatoResponse.status,
          response_text: responseText.substring(0, 500)
        });
        return NextResponse.json({ error: "Invalid response from Gelato API" }, { status: 500 });
      }

      if (!gelatoResponse.ok) {
        console.error("[gelato-direct] API error:", gelatoData);
        await logBookEvent(bookId, "gelato_order_creation_direct_failed", {
          reason: "Gelato API error",
          approval_id: approvalId,
          order_id: orderId,
          status_code: gelatoResponse.status,
          error_details: gelatoData
        });
        return NextResponse.json({ error: "Gelato API error", details: gelatoData }, { status: 500 });
      }

      console.log(`[gelato-direct] Order created successfully with ID: ${gelatoData.id}`);

      // --- Update Supabase tables (Optional but recommended) --- 
      // Update the orders table with the Gelato order ID
      try {
        const { error: orderUpdateError } = await supabase
          .from("orders")
          .update({ gelato_order_id: gelatoData.id })
          .eq("id", orderId);

        if (orderUpdateError) {
          console.error("[gelato-direct] Failed to update orders table with Gelato order ID:", orderUpdateError);
          // Log but don't fail the request
          await logBookEvent(bookId, "gelato_order_id_update_direct_failed", {
            approval_id: approvalId,
            order_id: orderId,
            gelato_order_id: gelatoData.id,
            error: orderUpdateError.message
          });
        } else {
          console.log(`[gelato-direct] Successfully updated orders table with Gelato order ID: ${gelatoData.id}`);
        }
      } catch (dbError) {
          console.error("[gelato-direct] DB Error updating order table:", dbError);
          // Log only
      }
      
      // NOTE: No need to update book_approvals.print_job_id here, 
      // as it was already set during the initial approval or provided by the caller.

      // Log successful order creation
      await logBookEvent(bookId, "gelato_order_created_direct_successfully", {
        approval_id: approvalId,
        order_id: orderId,
        gelato_order_id: gelatoData.id,
        print_job_id: printJobId,
        // estimated_shipping_date: gelatoData.estimatedShippingDate || null // If needed
      });

      return NextResponse.json({
        message: "Order created successfully in Gelato via direct route",
        gelatoOrderId: gelatoData.id,
        printJobId: printJobId,
        orderDetails: gelatoData
      });

    } catch (fetchError) {
      console.error(`[gelato-direct] Network error calling Gelato API: ${fetchError}`);
      await logBookEvent(bookId, "gelato_order_creation_direct_failed", {
        reason: "Network error",
        approval_id: approvalId,
        order_id: orderId,
        error: fetchError instanceof Error ? fetchError.message : String(fetchError)
      });
      return NextResponse.json({ error: "Network error calling Gelato API" }, { status: 500 });
    }

  } catch (error) {
    console.error("[gelato-direct] Unexpected error:", error);
    // Log unexpected errors (best effort)
    let bookIdForLog = "unknown";
    try {
      const body = await request.json();
      bookIdForLog = body?.bookId || "unknown";
      await logBookEvent(bookIdForLog, "gelato_order_creation_direct_exception", {
         error: error instanceof Error ? error.message : String(error),
         approval_id: body?.approvalId,
         order_id: body?.orderId
      });
    } catch (logError) {
        console.error("[gelato-direct] Failed to log unexpected error:", logError);
    }
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
} 