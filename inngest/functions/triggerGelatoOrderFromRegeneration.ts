import { supabaseSecretKey, supabaseUrl } from '@/lib/supabase-server-env'
import { inngest } from "../client";
import { createClient } from "@supabase/supabase-js";
import { logBookEvent } from "../../lib/book-logger";
import { refreshPdfUrl } from "@/lib/refresh-pdf-url";

// Initialize Supabase client using service role for server-side operations
const supabase = createClient(supabaseUrl, supabaseSecretKey);

export const triggerGelatoOrderFromRegeneration = inngest.createFunction(
  {
    id: "trigger-gelato-order-from-regeneration",
    name: "trigger-gelato-order-from-regeneration",
    // Define appropriate concurrency, priority, retries if needed
    // concurrency: { limit: 5 },
    // retries: 3
  },
  { event: "internal/pdf.regenerated.notification" },
  async ({ event, step }) => {
    console.log("Received PDF regenerated notification, preparing direct Gelato trigger:", event.data);

    const { orderId, bookId } = event.data;

    if (!orderId || !bookId) {
      console.error("Missing orderId or bookId in event data:", event.data);
      throw new Error("Missing orderId or bookId in internal/pdf.regenerated.notification event.");
    }

    // Log start
    await step.run("log-start-event", async () => {
      await logBookEvent(bookId, "gelato_order_trigger_from_regen_started", {
        order_id: orderId
      });
    });

    // 1. Fetch Approval Record (need id, print_job_id, pdf_url)
    const { data: approvalData, error: approvalError } = await step.run(
      "fetch-approval-record",
      async () => {
        console.log(`Fetching approval record for orderId: ${orderId}`);
        return await supabase
          .from("book_approvals")
          .select("id, print_job_id, status, pdf_url") // Need pdf_url now
          .eq("order_id", orderId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
      }
    );

    if (approvalError) {
      console.error(`Supabase error fetching approval record for orderId ${orderId}:`, approvalError);
      // Log failure
      await step.run("log-fetch-failure", async () => {
        await logBookEvent(bookId, "gelato_order_trigger_from_regen_failed", {
            reason: "Supabase error fetching approval",
            order_id: orderId,
            error: approvalError.message
        });
      });
      throw new Error(`DB error fetching approval record: ${approvalError.message}`);
    }

    if (!approvalData) {
      console.error(`No book_approvals record found for orderId ${orderId}`);
      // Log failure
      await step.run("log-not-found-failure", async () => {
        await logBookEvent(bookId, "gelato_order_trigger_from_regen_failed", {
            reason: "Approval record not found",
            order_id: orderId
        });
      });
      // Consider if this should be a fatal error or just logged.
      // If the PDF was regenerated, an approval should ideally exist.
      throw new Error(`Approval record not found for order ${orderId}`);
    }

    console.log(`Found approval: id=${approvalData.id}, print_job_id=${approvalData.print_job_id}, status=${approvalData.status}`);

    // Ensure the book was actually approved
    if (approvalData.status !== "approved") {
        console.warn(`Approval status for orderId ${orderId} is '${approvalData.status}', not 'approved'. Gelato order will not be triggered.`);
        // Log skipped event
        await step.run("log-skipped-event", async () => {
           await logBookEvent(bookId, "gelato_order_trigger_from_regen_skipped", {
                reason: "Approval status not approved",
                order_id: orderId,
                approval_id: approvalData.id,
                status: approvalData.status
           });
        });
        // Decide if this needs further action or just logging.
        return { status: "skipped", reason: "Approval status was not 'approved'", approvalId: approvalData.id };
    }

    if (!approvalData.print_job_id) {
        console.error(`Missing print_job_id in approval record id ${approvalData.id} for orderId ${orderId}. Cannot trigger Gelato.`);
        // Log failure
        await step.run("log-missing-print-job-id-failure", async () => {
            await logBookEvent(bookId, "gelato_order_trigger_from_regen_failed", {
                reason: "Missing print_job_id in approval record",
                order_id: orderId,
                approval_id: approvalData.id
            });
        });
        // This indicates a potential issue in the original approval flow.
        throw new Error(`Missing print_job_id for approval ${approvalData.id}`);
    }

    if (!approvalData.pdf_url) {
        console.error(`Missing pdf_url in approval record id ${approvalData.id}`);
        await step.run("log-missing-pdf-url", async () => {
            await logBookEvent(bookId, "gelato_order_trigger_from_regen_failed", {
                reason: "Missing pdf_url in approval record",
                order_id: orderId,
                approval_id: approvalData.id
            });
        });
        throw new Error(`Missing pdf_url for approval ${approvalData.id}`);
    }

    const approvalId = approvalData.id;
    const printJobId = approvalData.print_job_id;

    // 2. Fetch Order Record (need new ship_* columns, email, name)
    const { data: orderData, error: orderError } = await step.run(
      "fetch-order-record",
      async () => {
        console.log(`Fetching order record for orderId: ${orderId}`);
        return await supabase
          .from("orders")
          .select("id, customer_email, customer_name, ship_line1, ship_line2, ship_city, ship_state, ship_postal, ship_country, phone_number") // Fetch all required fields
          .eq("id", orderId)
          .single();
      }
    );

    if (orderError) {
      console.error(`Supabase error fetching order record for orderId ${orderId}:`, orderError);
      // Log failure
      await step.run("log-fetch-failure-order", async () => { // Renamed step for clarity
        await logBookEvent(bookId, "gelato_order_trigger_from_regen_failed", {
            reason: "Supabase error fetching order record",
            order_id: orderId,
            error: orderError.message
        });
      });
      throw new Error(`DB error fetching order record: ${orderError.message}`);
    }

    if (!orderData) {
      console.error(`No orders record found for orderId ${orderId}`);
      // Log failure
       await step.run("log-not-found-failure-order", async () => { // Renamed step
        await logBookEvent(bookId, "gelato_order_trigger_from_regen_failed", {
            reason: "Order record not found",
            order_id: orderId
        });
      });
      // Consider if this should be a fatal error or just logged.
      // If the PDF was regenerated, an order should ideally exist.
      throw new Error(`Order record not found for order ${orderId}`);
    }

    // Updated log to reflect available data
    console.log(`Found order: id=${orderData.id}, email=${orderData.customer_email ? 'present' : 'missing'}, name=${orderData.customer_name ? 'present' : 'missing'}, address_line1=${orderData.ship_line1 ? 'present' : 'missing'}`);

    // Validate required fields from the order record
    const requiredOrderFields = [
        'customer_email',
        'customer_name',
        'ship_line1',
        'ship_city',
        'ship_postal',
        'ship_country'
    ];
    const missingOrderFields = requiredOrderFields.filter(field => !(orderData as any)[field]);

    if (missingOrderFields.length > 0) {
        console.error(`Missing required fields in order ${orderId}: ${missingOrderFields.join(', ')}`);
        await step.run("log-missing-order-data", async () => {
            await logBookEvent(bookId, "gelato_order_trigger_from_regen_failed", {
                reason: "Missing required data in order record",
                order_id: orderId,
                missing_fields: missingOrderFields
            });
        });
        throw new Error(`Missing required data in order ${orderId}: ${missingOrderFields.join(', ')}`);
    }

    // 3. Prepare Gelato Shipping Address directly (no parsing needed)
    let firstName = "";
    let lastName = "."; // Default
    if (orderData.customer_name) {
        const nameParts = orderData.customer_name.trim().split(/\s+/);
        firstName = nameParts[0] || ".";
        lastName = nameParts.slice(1).join(" ") || ".";
    }

    const directShippingAddress = {
        firstName: firstName,
        lastName: lastName,
        addressLine1: orderData.ship_line1,
        addressLine2: orderData.ship_line2 || "",
        city: orderData.ship_city,
        postCode: orderData.ship_postal,
        state: orderData.ship_state || "",
        country: orderData.ship_country,
        phone: orderData.phone_number || "", // Include phone if available
        // email is added separately in the request body below
    };

    console.log(`Successfully prepared direct shipping address for order ${orderId}`);

    // 4. Get Fresh Signed PDF URL (48 hours expiry) using URL from event
    // Use the PDF URL provided in the event data, which points to the REGENERATED PDF
    const regeneratedPdfUrlFromEvent = event.data.pdfUrl; 
    if (!regeneratedPdfUrlFromEvent) {
        console.error("Missing pdfUrl in event data:", event.data);
        // Log and throw critical error
         await step.run("log-missing-event-pdf-url", async () => {
            await logBookEvent(bookId, "gelato_order_trigger_from_regen_failed", {
                reason: "Missing pdfUrl in internal/pdf.regenerated.notification event",
                order_id: orderId,
                approval_id: approvalData.id
            });
        });
        throw new Error("Missing pdfUrl in internal/pdf.regenerated.notification event.");
    }
    
    const accessiblePdfUrl = await step.run("get-authenticated-signed-pdf-url", () =>
      refreshPdfUrl(regeneratedPdfUrlFromEvent, process.env.NEXT_PUBLIC_APP_URL!, 172800)
    );

    // 5. Trigger the NEW Gelato order creation API endpoint
    const directApiUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/gelato/create-order-direct`;
    const requestBody = {
        bookId: bookId,
        orderId: orderId,
        approvalId: approvalData.id, // Keep original approval ID for reference
        printJobId: approvalData.print_job_id, // Keep original print job ID
        // Only pass the freshly signed PDF for this regenerated artifact.
        pdfUrl: accessiblePdfUrl,
        customerEmail: orderData.customer_email,
        shippingAddress: directShippingAddress // Pass the directly constructed object
    };

    console.log("Calling DIRECT Gelato trigger API: [omitted] with body: [omitted]");

    const { responseStatus, responseBody } = await step.run("trigger-direct-gelato-api", async () => {
      try {
        const response = await fetch(directApiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Internal-Secret": process.env.INTERNAL_API_SECRET! },
          body: JSON.stringify(requestBody),
        });

        const responseBodyText = await response.text();
        let responseBodyJson = null;
        try {
            responseBodyJson = JSON.parse(responseBodyText);
        } catch (e) {
            console.warn(`Failed to parse Gelato trigger API response as JSON: ${responseBodyText}`);
        }

        return {
            responseStatus: response.status,
            responseBody: responseBodyJson || { error: 'Non-JSON', text: responseBodyText }
        };

      } catch (error: any) {
        console.error(`Network/fetch error calling DIRECT Gelato API for order ${orderId}:`, error);
        // Let Inngest handle retries by throwing the error
        throw error;
      }
    });

    if (responseStatus >= 200 && responseStatus < 300) {
      console.log(`Successfully triggered Gelato (direct) for order ${orderId}. API Response:`, responseBody);
      // Log successful trigger event
      await step.run("log-direct-success-event", async () => {
         await logBookEvent(bookId, "gelato_order_trigger_from_regen_succeeded", {
             order_id: orderId,
             approval_id: approvalId,
             print_job_id: printJobId,
             gelato_api_status: responseStatus,
             gelato_order_id: responseBody?.gelatoOrderId // Extract if available
         });
      });
      return { status: "success", orderId, approvalId, printJobId, gelatoApiResponse: responseBody };
    } else {
      console.error(`Failed to trigger Gelato (direct) for order ${orderId}. Status: ${responseStatus}, Response:`, responseBody);
      // Log failed trigger event
      await step.run("log-direct-api-failure", async () => {
          await logBookEvent(bookId, "gelato_order_trigger_from_regen_failed", {
             reason: "Gelato trigger API call failed",
             order_id: orderId,
             approval_id: approvalId,
             print_job_id: printJobId,
             gelato_api_status: responseStatus,
             gelato_api_response: responseBody
          });
      });
      // Throw an error to signal failure to Inngest, allowing for retries
      throw new Error(`Gelato trigger API call failed with status ${responseStatus}`);
    }
  }
);

// Remember to export this function in inngest/index.ts 