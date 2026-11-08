import { supabaseSecretKey, supabaseUrl } from '@/lib/supabase-server-env'
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminUser } from "@/lib/admin-auth";
import { verifyInternalSecret } from "@/lib/internal-auth";

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseSecretKey);

export async function POST(request: Request) {
  try {
    if (!verifyInternalSecret(request)) {
      const adminCheck = await requireAdminUser();
      if (!adminCheck.ok) {
        return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
      }
    }

    const { orderId, token } = await request.json();

    if (!orderId || !token) {
      return NextResponse.json({ error: "Missing orderId or token" }, { status: 400 });
    }

    // 1. Fetch phone number from Supabase
    // IMPORTANT: Adjust 'orders', 'order_id', and 'phone_number' if your table/column names are different
    const { data: orderData, error: orderError } = await supabase
      .from("orders") // Assuming your table is named 'orders'
      .select("phone_number") // Assuming the column is 'phone_number'
      .eq("id", orderId) // Assuming the column is 'order_id'
      .single();

    if (orderError) {
      console.error(`Supabase query failed for order ${orderId}: ${orderError.message}`);
      return NextResponse.json({ error: "Failed to fetch phone number" }, { status: 500 });
    }

    if (!orderData?.phone_number) {
      console.log(`No phone number found for order ${orderId}.`);
      return NextResponse.json({ error: "No phone number found for this order" }, { status: 404 });
    }

    const phoneNumber = orderData.phone_number;

    // 2. Construct URL and message (similar to sendPreviewSms.ts)
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://www.example.com"; // Fallback to production URL
    const previewUrl = `${baseUrl}/preview?token=${token}`;
    // You might want to distinguish if this is an initial send or a resend.
    // For simplicity, using the general message here.
    const messageBody = `📚 Your Storybook Starter book preview is ready! View it here: ${previewUrl}`;

    // 3. Send SMS via Twilio
    const { default: twilio } = await import("twilio");
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );
    const msg = await client.messages.create({
      body: messageBody,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: phoneNumber,
    });

    return NextResponse.json({ sid: msg.sid });
  } catch (err: any) {
    console.error("SMS sending error:", err);
    // Check if the error is from Supabase or Twilio or JSON parsing for more specific messages
    const errorMessage = err.message || "An unexpected error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
