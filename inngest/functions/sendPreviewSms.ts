import { supabaseSecretKey, supabaseUrl } from '@/lib/supabase-server-env'
import { createClient } from "@supabase/supabase-js";
import { inngest } from "../client";
import { sendSms } from "@/lib/twilio";
import { notifyOrderUpdate } from '@/lib/slack';

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseSecretKey);

interface SmsEventData {
  orderId: string;
  token: string;
}

// Define explicit return types for the handler
type SmsHandlerSuccessResult = { success: true; phoneNumber: string; bookId: string };
type SmsHandlerFailureResult = { success: false; reason: string };
type SmsHandlerResult = SmsHandlerSuccessResult | SmsHandlerFailureResult;

// Shared logic for sending SMS with explicit return type
async function handleSendSms(orderId: string, token: string, eventType: string): Promise<SmsHandlerResult> {
  let phoneNumber: string | null = null;
  let bookId: string | null = null;

  // 1. Fetch phone number from Supabase
  try {
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("phone_number, book_id")
      .eq("id", orderId)
      .single();

    if (orderError) {
      console.error(`Supabase query failed for order ${orderId}: ${orderError.message}`);
      throw new Error(`Supabase query failed`);
    }

    if (!orderData?.phone_number) {
      console.log(`No phone number found for order ${orderId}. Skipping SMS.`);
      return { success: false, reason: "No phone number found" };
    }

    phoneNumber = orderData.phone_number;
    bookId = orderData.book_id;
    console.log("Found phone number for order [omitted]: [omitted]");

  } catch (error: any) {
    console.error("Error fetching phone number step for order [omitted]:");
    throw error; // Re-throw to trigger Inngest retry
  }

  // Ensure phone number is not null before proceeding (TypeScript check)
  if (!phoneNumber) {
     console.error(`Phone number became null unexpectedly for order ${orderId}`);
     return { success: false, reason: "Phone number null unexpectedly" };
  }

  // 2. Construct URL and message
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://www.example.com");
  const previewUrl = `${baseUrl}/preview?token=${token}`;
  const messageBody = eventType === "book/preview.sms.resend.requested"
    ? `📚 Your updated Small Tales book preview is ready! View it here: ${previewUrl}`
    : `📚 Your Small Tales book preview is ready! View it here: ${previewUrl}`;

  // 3. Send SMS via Twilio
  try {
    await sendSms(phoneNumber, messageBody); // phoneNumber is guaranteed string here
    return { success: true, phoneNumber, bookId: bookId! };
  } catch (twilioError: any) {
    console.error("Twilio sending failed for order [omitted] (phone: [omitted]):");
    throw new Error("Twilio send failed");
  }
}

// Trigger for initial SMS request
export const sendPreviewSmsTrigger = inngest.createFunction(
  {
    id: "send-preview-sms",
    name: "Send Book Preview SMS",
    retries: 3,
    concurrency: { limit: 5 },
  },
  { event: "book/preview.sms.requested" },
  async ({ event, step }) => {
    const { orderId, token } = event.data as SmsEventData;
    console.log(`Received event ${event.name} for order: ${orderId}`);

    const result = await step.run("send-initial-sms-step", () =>
        handleSendSms(orderId, token, event.name)
    );

    // Type guard helps TypeScript understand the shape of result
    if (result.success === true) { // Explicitly check for true
        console.log("Successfully processed [omitted] for order [omitted], SMS potentially sent to [omitted].");
        await notifyOrderUpdate({ orderId, bookId: result.bookId, message: 'Text notification sent' })
        return { event: event.name, orderId: orderId, status: 'SMS sent' };
    } else { // result.success is false
        console.log(`Processing ${event.name} for order ${orderId} completed, but SMS not sent: ${result.reason}`);
        return { event: event.name, orderId: orderId, status: 'SMS skipped', reason: result.reason };
    }
  }
);

// Trigger for resend SMS request
export const resendPreviewSmsTrigger = inngest.createFunction(
  {
    id: "resend-preview-sms",
    name: "Resend Book Preview SMS",
    retries: 3,
    concurrency: { limit: 5 },
  },
  { event: "book/preview.sms.resend.requested" },
  async ({ event, step }) => {
    const { orderId, token } = event.data as SmsEventData;
    console.log(`Received event ${event.name} for order: ${orderId}`);

    const result = await step.run("resend-sms-step", () =>
        handleSendSms(orderId, token, event.name)
    );

    // Type guard helps TypeScript understand the shape of result
     if (result.success === true) { // Explicitly check for true
        console.log("Successfully processed [omitted] for order [omitted], SMS potentially sent to [omitted].");
        await notifyOrderUpdate({ orderId, bookId: result.bookId, message: 'Text notification resent' })
        return { event: event.name, orderId: orderId, status: 'SMS sent' };
    } else { // result.success is false
        console.log(`Processing ${event.name} for order ${orderId} completed, but SMS not sent: ${result.reason}`);
        return { event: event.name, orderId: orderId, status: 'SMS skipped', reason: result.reason };
    }
  }
);
