import { supabaseSecretKey, supabaseUrl } from '@/lib/supabase-server-env'
import { NextResponse } from 'next/server';
import { createClient } from "@supabase/supabase-js";
import { EMAIL_FROM_UPDATES, sendEmail } from '@/lib/email';
import { notifyBookShipped, notifyBookDelivered, notifyOrderUpdate } from '@/lib/slack';
import crypto from 'crypto';

// Initialize Supabase client to look up customer email
const supabase = createClient(supabaseUrl, supabaseSecretKey);

// Get Gelato webhook secret from environment variables
const gelatoWebhookSecret = process.env.GELATO_WEBHOOK_SECRET_NONINNGEST!;

// Export the runtime config for Next.js App Router
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Function to log events to the gelato_logs table
async function logEvent(event: any) {
  const { error } = await supabase
    .from("gelato_logs")
    .insert({
      event_name: event.event,
      event_data: event,
    });
  if (error) {
    console.error("Failed to log event:", error);
  }
}

// Function to send error email to yourself
async function sendErrorEmail(error: any, event: any) {
  const email = process.env.ADMIN_NOTIFICATION_EMAIL || "admin@example.com";
  const subject = `Error processing Gelato webhook event: ${event.event}`;
  const message = `An error occurred while processing the event: ${JSON.stringify(event)}\n\nError details: ${error.message}`;

  await sendEmail({
    from: EMAIL_FROM_UPDATES,
    to: email,
    subject,
    text: message,
  });
}

export async function POST(request: Request) {
  let evt: any;
  try {
    // Get the auth header
    const authHeader = request.headers.get('X-Gelato-Auth');
    
    // Verify the webhook auth using timing-safe comparison to prevent timing attacks
    if (!authHeader || !gelatoWebhookSecret ||
        !crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(gelatoWebhookSecret))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get the webhook payload
    evt = await request.json();
    
    // Log the event
    await logEvent(evt);
    
    // Process order status updates and item status updates
    if ((evt.event === 'order_status_updated' || evt.event === 'order_item_status_updated') && evt.orderId) {
      try {
        // Get the status from the appropriate field based on event type
        const status = evt.event === 'order_item_status_updated' ? evt.status : evt.fulfillmentStatus;
        
        // Prepare update data
        const updateData: any = {
          shipping_status: status
        };

        // Add carrier and tracking if available
        if (evt.items?.[0]?.fulfillments?.[0]) {
          const fulfillment = evt.items[0].fulfillments[0];
          if (fulfillment.shipmentMethodName) {
            updateData.carrier = fulfillment.shipmentMethodName;
          }
          if (fulfillment.trackingCode) {
            updateData.tracking_number = fulfillment.trackingCode;
          }
        }

        // Update the order in Supabase
        const { error: updateError } = await supabase
          .from('orders')
          .update(updateData)
          .eq('gelato_order_id', evt.orderId);

        if (updateError) {
          throw updateError;
        }

        if (status === 'passed') {
          try {
            const { data: orderData } = await supabase
              .from('orders')
              .select('id, book_id')
              .eq('gelato_order_id', evt.orderId)
              .single();
            if (orderData) {
              await notifyOrderUpdate({ orderId: orderData.id, bookId: orderData.book_id, message: 'Gelato print job passed' })
            }
          } catch (notificationError) {
            console.error('Error sending print job passed notification:', notificationError)
          }
        }

        // Send Slack notifications for shipped or delivered status
        if (status === 'shipped' || status === 'delivered') {
          try {
            // Fetch order and book data for notifications
            const { data: orderData } = await supabase
              .from('orders')
              .select(`
                id,
                book_id,
                customer_email,
                customer_name,
                books (
                  name
                )
              `)
              .eq('gelato_order_id', evt.orderId)
              .single();

            if (orderData) {
              const fulfillment = evt.items?.[0]?.fulfillments?.[0];
              const notificationData = {
                bookId: orderData.book_id,
                orderId: orderData.id,
                gelatoOrderId: evt.orderId,
                customerEmail: orderData.customer_email,
                customerName: orderData.customer_name,
                characterName: (orderData.books as any)?.name,
                trackingNumber: fulfillment?.trackingCode,
                trackingUrl: fulfillment?.trackingUrl,
                carrier: fulfillment?.shipmentMethodName || fulfillment?.carrierName,
                fulfillmentCountry: fulfillment?.fulfillmentCountry
              };

              if (status === 'shipped') {
                await notifyBookShipped(notificationData);
                await notifyOrderUpdate({ orderId: orderData.id, bookId: orderData.book_id, message: 'Book shipped' })
              } else if (status === 'delivered') {
                await notifyBookDelivered(notificationData);
                await notifyOrderUpdate({ orderId: orderData.id, bookId: orderData.book_id, message: 'Book delivered' })
              }
            }
          } catch (notificationError) {
            console.error('Error sending delivery notification:', notificationError);
            // Don't fail the webhook - notification failure isn't critical
          }
        }
      } catch (error) {
        console.error('Error updating order status:', error);
        await sendErrorEmail(error, evt);
        // Don't return error response - we still want to acknowledge the webhook
      }
    }
    
    // Return success response with proper headers
    return new NextResponse(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error processing Gelato webhook:', error);
    
    // Send error email to yourself
    await sendErrorEmail(error, evt);

    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
