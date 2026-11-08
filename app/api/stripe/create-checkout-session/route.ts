import { readBoundedJsonObject, BodyLimitError } from '@/lib/request-body';
import { hasBookAccess } from '@/lib/guest-access';
import { guardPublicRequest } from '@/lib/request-security';
// /app/api/stripe/create-checkout-session/route.ts
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";
import { supabase } from "@/utils/supabase";
import { logBookEvent } from "@/lib/book-logger";
import { notifyBookCheckout } from "@/lib/slack";
import { headers } from 'next/headers';
import Stripe from 'stripe';

export async function POST(req: Request) {
  const denied = await guardPublicRequest(req, 'checkout');
  if (denied) return denied;
  let parsedBookId: string | null = null;
  try {
    const { bookId, smsOptIn } = await readBoundedJsonObject(req);
    if (typeof bookId !== 'string' || !hasBookAccess(req, bookId)) return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    parsedBookId = bookId;
    const headersList = await headers();
    const userAgent = headersList.get('user-agent');
    
    // Validate required environment variables
    if (!process.env.STRIPE_TAX_RATE_ID || !process.env.STRIPE_SHIPPING_RATE_ID || !process.env.STRIPE_PAYMENT_METHOD_CONFIGURATION_ID) {
      throw new Error("Missing required Stripe configuration");
    }
    
    if (!bookId) {
      // Log missing bookId error
      logBookEvent(null, "checkout_session_error", {
        error: "Missing bookId in request",
        timestamp: new Date().toISOString()
      });
      
      return NextResponse.json({ error: "Missing bookId" }, { status: 400 });
    }
    
    // Fetch book details for the notification
    const { data: book } = await supabase
      .from('books')
      .select('*')
      .eq('id', bookId)
      .single();
    
    if (!book || book.status !== 'completed') return NextResponse.json({ error: 'Book preview is not ready' }, { status: 400 });

    // Create Stripe session first
    const sessionCreateParams: Stripe.Checkout.SessionCreateParams = {
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID!,
          quantity: 1,
        },
      ],
      mode: "payment",
      payment_method_configuration: process.env.STRIPE_PAYMENT_METHOD_CONFIGURATION_ID!,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/create-book`,
      automatic_tax: { enabled: true },
      consent_collection: {
        terms_of_service: "required",
      },
      metadata: {
        bookId,
        userAgent: userAgent || null,
      },
      shipping_address_collection: {
        allowed_countries: ['US'],
      },
      shipping_options: [
        {
          shipping_rate: process.env.STRIPE_SHIPPING_RATE_ID!,
        },
      ],
      billing_address_collection: 'required',
      phone_number_collection: {
        enabled: true,
      },
      custom_text: {
        shipping_address: {
          message: "Please enter the shipping address for your book delivery"
        },
        submit: {
          message: "We'll start creating your book right after payment"
        }
      },
      payment_intent_data: {
        metadata: {
          bookId,
          userAgent: userAgent || null,
        }
      },
      allow_promotion_codes: true,
    };

    const session = await stripe.checkout.sessions.create(sessionCreateParams);

    // Log successful Stripe session creation
    logBookEvent(bookId, "checkout_session_created", {
      sessionId: session.id,
      bookId,
      timestamp: new Date().toISOString()
    });
    
    // Send Slack notification for checkout
    await notifyBookCheckout({
      bookId,
      sessionId: session.id,
      amount: 39.99,
      currency: 'USD'
    });

    // Create order record with stripe session id
    const { error: orderError } = await supabase
      .from('orders')
      .insert({
        book_id: bookId,
        stripe_session_id: session.id,
        payment_status: 'pending',
        shipping_status: 'pending',
        currency: 'USD',
        total_amount: 39.99,
        sms_preview_opt_in: smsOptIn === true,
        sms_preview_opted_in_at: smsOptIn === true ? new Date() : null,
      });

    if (orderError) {
      // Log order creation error
      logBookEvent(bookId, "order_creation_error", {
        error: orderError.message,
        details: orderError,
        sessionId: session.id,
        timestamp: new Date().toISOString()
      });
      
      throw orderError;
    }
    
    // Log successful order creation
    logBookEvent(bookId, "order_created", {
      sessionId: session.id,
      bookId,
      paymentStatus: 'pending',
      shippingStatus: 'pending',
      amount: 39.99,
      currency: 'USD',
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({ sessionUrl: session.url });
  } catch (error) {
    if (error instanceof BodyLimitError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Error creating checkout session:", error);
    
    // Log checkout error
    logBookEvent(parsedBookId, "checkout_session_error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json({ error: "Error creating checkout session" }, { status: 500 });
  }
}  