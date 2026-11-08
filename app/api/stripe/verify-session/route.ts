// /app/api/stripe/verify-session/route.ts
import { stripe } from "@/lib/stripe"
import { NextResponse } from "next/server"
import { supabase } from "@/utils/supabase"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get("session_id")

  if (!sessionId) {
    return NextResponse.json({ success: false, error: "No session ID provided" }, { status: 400 })
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    
    // Get orderId for event_id generation
    let orderId = null
    if (session.payment_status === "paid") {
      const { data: order } = await supabase
        .from('orders')
        .select('id')
        .eq('stripe_session_id', sessionId)
        .single()
      orderId = order?.id || null
    }
    
    return NextResponse.json({
      success: true,
      paid: session.payment_status === "paid",
      customerEmail: session.customer_details?.email,
      currency: session.currency?.toUpperCase(),
      value: session.amount_total ? session.amount_total / 100 : 0,
      orderId: orderId,
      clearStorage: session.payment_status === "paid"
    })
  } catch (error) {
    console.error("Error verifying Stripe session:", error)
    return NextResponse.json({ success: false, error: "Invalid session ID" }, { status: 400 })
  }
} 