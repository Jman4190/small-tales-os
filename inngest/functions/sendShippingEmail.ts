import { supabaseSecretKey, supabaseUrl } from '@/lib/supabase-server-env'
import { createClient } from "@supabase/supabase-js";
import { createElement } from 'react';
import { inngest } from "../client";
import { NonRetriableError } from 'inngest';
import { ShippingEmailTemplate } from '@/components/email-templates';
import { EMAIL_FROM_UPDATES, EMAIL_REPLY_TO_SUPPORT, PermanentEmailError, sendEmail } from '@/lib/email';

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseSecretKey);

interface EmailLog {
  orderId: string;
  userEmail: string;
  status: "pending" | "sent" | "failed";
  messageId?: string;
  error?: string;
  itemId?: string;
  orderStatus?: string;
  gelatoOrderId?: string;
}

// Gelato webhook payload interface
interface GelatoFulfillment {
  fulfillmentCountry: string;
  fulfillmentFacilityId: string;
  fulfillmentStateProvince: string;
  shipmentMethodName: string;
  shipmentMethodUid: string;
  trackingCode: string;
  trackingUrl: string;
}

interface GelatoItem {
  fulfillmentStatus: string;
  fulfillments: GelatoFulfillment[];
  itemReferenceId: string;
}

interface GelatoWebhookPayload {
  event: string;
  fulfillmentStatus: string;
  id: string;
  items: GelatoItem[];
  orderId: string;
  orderReferenceId: string;
  storeId: string | null;
}

// Define the event structure for Inngest
interface GelatoOrderStatusUpdatedEvent {
  name: "gelato/order_status_updated";
  data: GelatoWebhookPayload;
  id: string;
  ts: number;
}

async function logEmailSend(log: EmailLog) {
  const { error } = await supabase
    .from("email_logs")
    .insert({
      order_id: log.orderId,
      user_email: log.userEmail,
      status: log.status,
      message_id: log.messageId || null,
      error: log.error || null,
      item_id: log.itemId || null,
      order_status: log.orderStatus || null,
      gelato_order_id: log.gelatoOrderId || null,
    });
  if (error) {
    console.error("Failed to log email send:", error);
  }
}

// Add the Inngest trigger function
export const sendShippingEmailTrigger = inngest.createFunction(
  { 
    id: "send-shipping-email",
    priority: {
      run: "100", // Low priority (100 seconds)
    },
    concurrency: {
      limit: 5, // Emails can be sent in parallel
    }
  },
  { event: "gelato/order_status_updated" },
  async ({ event, step }) => {
    // Type the event properly
    const gelatoEvent = event as unknown as GelatoOrderStatusUpdatedEvent;
    const gelatoData = gelatoEvent.data;
    
    // Map Gelato webhook data to our expected structure
    const orderId = gelatoData.orderReferenceId || gelatoData.orderId;
    const status = gelatoData.fulfillmentStatus;
    const gelatoOrderId = gelatoData.id;
    
    // Get the first item's data for tracking info
    const firstItem = gelatoData.items && gelatoData.items.length > 0 ? gelatoData.items[0] : null;
    const firstFulfillment = firstItem?.fulfillments && firstItem.fulfillments.length > 0 
      ? firstItem.fulfillments[0] 
      : null;
    
    const itemId = firstItem?.itemReferenceId;
    const trackingNumber = firstFulfillment?.trackingCode;
    const trackingUrl = firstFulfillment?.trackingUrl;
    const shippingProvider = firstFulfillment?.shipmentMethodName;
    const fulfillmentCountry = firstFulfillment?.fulfillmentCountry;
    
    // Fetch user email from database using orderId
    console.log(`Fetching email for order ID: ${orderId}`);
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("customer_email")
      .eq("id", orderId)
      .single();
    console.log("Order data: [omitted], Error: [omitted]");
      
    if (orderError || !orderData) {
      console.error(`Failed to fetch email for order ${orderId}:`, orderError);
      return {
        skipped: true,
        reason: `Email not sent because order data could not be retrieved`,
        orderId: orderId
      };
    }
    
    const email = orderData.customer_email;
    const allItems = gelatoData.items;

    // Only proceed if the status is "shipped"
    if (status !== "shipped") {
      console.log(`Skipping email for order ${orderId} with status ${status} - only sending emails for "shipped" status`);
      return {
        skipped: true,
        reason: `Email not sent because status is "${status}" (only sending for "shipped" status)`,
        orderId,
        status
      };
    }

    // Log pending email
    await logEmailSend({ 
      orderId, 
      userEmail: email, 
      status: "pending",
      itemId,
      orderStatus: status,
      gelatoOrderId
    });

    // Set email subject for shipped status
    const subject = `Your Order #${orderId} is on its way!`;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://www.example.com");
    const previewUrl = trackingUrl || `${baseUrl}/orders/${orderId}`;

    try {
      // Log additional information for debugging
      console.log(`Sending shipping email for order ${orderId} to ${email}`);
      if (allItems && allItems.length > 0) {
        console.log(`Order has ${allItems.length} items`);
      }

      const emailResponse = await sendEmail({
        from: EMAIL_FROM_UPDATES,
        to: email,
        subject,
        replyTo: EMAIL_REPLY_TO_SUPPORT,
        react: createElement(ShippingEmailTemplate, {
          previewUrl,
          status,
          orderId,
          trackingNumber,
          shippingProvider,
          fulfillmentCountry
        }),
      });

      // Log successful email
      await logEmailSend({
        orderId,
        userEmail: email,
        status: "sent",
        messageId: emailResponse.id,
        itemId,
        orderStatus: status,
        gelatoOrderId
      });

      return emailResponse;
    } catch (error: any) {
      // Log failed email
      await logEmailSend({
        orderId,
        userEmail: email,
        status: "failed",
        error: error.message,
        itemId,
        orderStatus: status,
        gelatoOrderId
      });
      console.error("Email send failed:", error);
      if (error instanceof PermanentEmailError) {
        throw new NonRetriableError(`Email send failed: ${error.message}`);
      }
      throw new Error(`Email send failed: ${error.message}`);
    }
  }
);
