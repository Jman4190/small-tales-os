// /app/api/stripe/webhooks/route.ts
import { stripe } from "@/lib/stripe";
import { headers } from "next/headers";
import Stripe from "stripe";
import { supabase } from "@/utils/supabase";
import { inngest } from "@/inngest/client";
import { notifyStripeCheckout } from "@/lib/slack";
import { sendFacebookPurchaseEvent } from "@/lib/facebook";
import { trackCheckoutAndPayment } from "@/lib/posthog-tracker";

const relevantEvents = new Set([
  "checkout.session.completed",
  "checkout.session.expired",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed"
]);

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const sig = headersList.get("Stripe-Signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event: Stripe.Event;

  try {
    if (!sig || !webhookSecret) {
      throw new Error("Webhook secret or signature missing");
    }
    console.log("Received Stripe webhook");
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (relevantEvents.has(event.type)) {
    try {
      const session = await stripe.checkout.sessions.retrieve(
        (event.data.object as Stripe.Checkout.Session).id,
        { expand: ['customer', 'line_items'] }
      );
      const paymentSettled = session.payment_status === 'paid' ||
        (session.payment_status === 'no_payment_required' && session.amount_total === 0);

      switch (event.type) {
        case "checkout.session.completed":
        case "checkout.session.async_payment_succeeded": {
          // Delayed payment methods can complete Checkout before funds settle.
          if (!paymentSettled) break;
          const bookId = session.metadata?.bookId;
          const userAgent = session.metadata?.userAgent;
          
          if (!bookId) {
            console.error("No book ID in session metadata for session:", session.id);
            return new Response(JSON.stringify({ error: "Missing book ID in session metadata" }), { status: 400 });
          }

          console.log("Processing completed session:", {
            id: session.id,
            bookId,
            metadata: session.metadata
          });

          const { data: order, error: orderFetchError } = await supabase
            .from('orders')
            .select('id')
            .eq('stripe_session_id', session.id)
            .single();

          if (orderFetchError || !order) {
            console.error("Order fetch error or order not found:", orderFetchError, "Session ID:", session.id);
            throw orderFetchError || new Error(`Order not found for session ${session.id}`);
          }

          // Extract custom field and ToS data
          // Older sessions used a yes/no dropdown; current SMS consent is stored
          // separately on the order and must not be overwritten by this field.
          const receivePdfViaText = session.custom_fields?.find(
            (f: any) => f.key === "receivepdfpreviewviatext"
          )?.dropdown?.value === "yes";

          // Check if consent and terms_of_service exist and if it was accepted
          const tosAccepted = session.consent?.terms_of_service === 'accepted';
          // Stripe sends the timestamp as a UNIX timestamp (seconds), convert to ISO string
          const tosTimestamp = session.metadata?.tos_acceptance_timestamp ? 
              new Date(parseInt(session.metadata.tos_acceptance_timestamp) * 1000).toISOString() : 
              null;
          const tosAcceptedAt = tosAccepted && tosTimestamp ? tosTimestamp : null;

          // Extract phone number
          const phoneNumber =
            session.customer_details?.phone ?? // Primary location
            session.shipping_details?.phone ?? // Wallets might put it here
            ((session.customer as Stripe.Customer | null)?.phone ?? null); // Fallback to customer object

          // Extract address components
          const addr = session.shipping_details?.address;

          const { error: orderUpdateError } = await supabase
            .from('orders')
            .update({
              payment_status: 'paid',
              total_amount: (session.amount_total ?? 0) / 100,
              currency: session.currency?.toUpperCase(),
              customer_email: session.customer_details?.email,
              customer_name: session.customer_details?.name,
              shipping_address: session.shipping_details ?? null,
              receive_pdf_preview_via_text: receivePdfViaText,
              tos_accepted_at: tosAcceptedAt,
              phone_number: phoneNumber,
              ship_line1:   addr?.line1 ?? null,
              ship_line2:   addr?.line2 ?? null,
              ship_city:    addr?.city ?? null,
              ship_state:   addr?.state ?? null,
              ship_postal:  addr?.postal_code ?? null,
              ship_country: addr?.country ?? null,
              updated_at: new Date().toISOString()
            })
            .eq('stripe_session_id', session.id);

          if (orderUpdateError) {
            console.error("Order update error:", orderUpdateError);
            throw orderUpdateError;
          }
          console.log("Order updated successfully for session:", session.id, "Order ID:", order.id);

          const { data: bookUpdateData, error: bookUpdateError } = await supabase
            .from('books')
            .update({
              order_id: order.id,
              status: 'paid'
            })
            .eq('id', bookId)
            // Replayed payment notifications must not reset generation progress.
            .is('order_id', null)
            .select('id')
            .maybeSingle();

          if (bookUpdateError) {
            console.error("Book update error or book not found:", bookUpdateError, "Book ID:", bookId);
            throw bookUpdateError;
          }
          console.log("Book updated successfully:", bookUpdateData);

          try {
            await sendFacebookPurchaseEvent(session, order.id, userAgent || null);
          } catch (fbError) {
            console.error("Error sending Facebook Purchase Event (caught in webhook):", fbError);
          }

          await inngest.send({
            id: `stripe-checkout-${session.id}`,
            name: "stripe/checkout.completed",
            data: {
              metadata: {
                bookId: bookId,
                orderId: order.id
              },
              session: {
                customer_email: session.customer_details?.email,
                customer_name: session.customer_details?.name,
                shipping_address: session.shipping_details
              }
            }
          });
          console.log("Inngest event sent for order:", order.id);

          await notifyStripeCheckout({
            bookId,
            orderId: order.id,
            customerEmail: session.customer_details?.email ?? undefined,
            customerName: session.customer_details?.name ?? undefined,
            amount: session.amount_total || 0,
            currency: session.currency || 'usd',
            shippingAddress: session.shipping_details
          }).catch(err => console.error('Failed to send Stripe checkout notification:', err));
          console.log("Slack notification sent for order:", order.id);

          const { data: bookData } = await supabase
            .from('books')
            .select('name, gender, age')
            .eq('id', bookId)
            .single();

          await trackCheckoutAndPayment({
            bookId,
            orderId: order.id,
            customerEmail: session.customer_details?.email ?? undefined,
            customerName: session.customer_details?.name ?? undefined,
            amount: session.amount_total || 0,
            currency: session.currency || 'usd',
            shippingAddress: session.shipping_details,
            name: bookData?.name,
            gender: bookData?.gender,
            age: bookData?.age
          }).catch(err => console.error('Failed to track checkout and payment:', err));

          break;
        }

        case "checkout.session.expired":
        case "checkout.session.async_payment_failed": {
          if (paymentSettled) break;
          // A later failure notification must not overwrite an already-paid row.
          const { error: orderUpdateError } = await supabase
            .from('orders')
            .update({ payment_status: 'failed', updated_at: new Date().toISOString() })
            .eq('stripe_session_id', session.id)
            .neq('payment_status', 'paid');
          if (orderUpdateError) throw orderUpdateError;
          // Keep the preview reusable and preserve any other paid order's book.
          break;
        }
        
        default:
           console.log(`Unhandled relevant event type: ${event.type}`);
      }

      return new Response(JSON.stringify({ received: true }), { status: 200 });

    } catch (error: any) {
      console.error("Webhook handler failed:", error.message, error.stack);
      return new Response(
        JSON.stringify({ error: "Webhook handler failed", details: error.message }),
        { status: 500 }
      );
    }
  } else {
     console.log(`Ignoring irrelevant event type: ${event.type}`);
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
