import { supabaseSecretKey, supabaseUrl } from '@/lib/supabase-server-env'
import { createClient } from "@supabase/supabase-js";
import { createElement } from 'react';
import { inngest } from "../client";
import { NonRetriableError } from 'inngest';
import { EmailTemplate } from '@/components/email-templates';
import { EMAIL_FROM_UPDATES, EMAIL_REPLY_TO_SUPPORT, PermanentEmailError, sendEmail } from '@/lib/email';
import { notifyPdfSentForApproval, notifyOrderUpdate } from '@/lib/slack';

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseSecretKey);

interface EmailLog {
  orderId: string;
  bookId: string;
  userEmail: string;
  token: string;
  status: "pending" | "sent" | "failed";
  messageId?: string;
  error?: string;
}

async function logEmailSend(log: EmailLog) {
  const { error } = await supabase
    .from("email_logs")
    .insert({
      order_id: log.orderId,
      book_id: log.bookId,
      user_email: log.userEmail,
      token: log.token,
      status: log.status,
      message_id: log.messageId || null,
      error: log.error || null,
    });
  if (error) {
    console.error("Failed to log email send:", error);
  }
}

interface SendEmailParams {
  userEmail: string;
  token: string;
  orderId: string;
  bookId: string;
}

export async function sendPreviewEmail({
  userEmail,
  token,
  orderId,
  bookId,
}: SendEmailParams) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://www.example.com");
  const previewUrl = `${baseUrl}/preview?token=${token}`;

  await logEmailSend({ orderId, bookId, userEmail, token, status: "pending" });

  // Get order data and character data for notification
  let smsOptIn = false;
  let customerName = '';
  let characterName = '';
  
  try {
    const [{ data: order }, { data: bookData }] = await Promise.all([
      supabase
        .from("orders")
        .select("sms_preview_opt_in, customer_name")
        .eq("id", orderId)
        .single(),
      supabase
        .from("books")
        .select("name")
        .eq("id", bookId)
        .single()
    ]);

    smsOptIn = order?.sms_preview_opt_in || false;
    customerName = order?.customer_name || '';
    characterName = bookData?.name || '';

    if (!smsOptIn) {
      console.log(`SMS opt-out for order ${orderId}; skipping SMS event`);
    } else {
      await inngest.send({
        name: "book/preview.sms.requested",
        data: { orderId, token },
      });
      console.log(`SMS request event sent for order ${orderId}`);
    }
  } catch (error) {
    console.error(`Failed to send SMS request event for order ${orderId}:`, error);
  }

  try {
    const emailResponse = await sendEmail({
      from: EMAIL_FROM_UPDATES,
      to: userEmail,
      subject: "Your Book Preview is Ready!",
      react: createElement(EmailTemplate, { previewUrl }),
      replyTo: EMAIL_REPLY_TO_SUPPORT,
    });

    await logEmailSend({
      orderId,
      bookId,
      userEmail,
      token,
      status: "sent",
      messageId: emailResponse.id,
    });

    // Send Slack notification that PDF was sent for approval
    try {
      await notifyPdfSentForApproval({
        bookId,
        orderId,
        customerEmail: userEmail,
        customerName,
        characterName,
        token,
        smsAlsoSent: smsOptIn,
        isResend: false
      });
    } catch (notificationError) {
      console.error('Failed to send PDF sent notification to Slack:', notificationError);
      // Don't throw - notification failure shouldn't break email sending
    }
    try {
      await notifyOrderUpdate({ orderId, bookId, message: 'Email notification sent' })
    } catch (notificationError) {
      console.error('Failed to send order update notification to Slack:', notificationError);
    }
    return emailResponse;
  } catch (error: any) {
    await logEmailSend({
      orderId,
      bookId,
      userEmail,
      token,
      status: "failed",
      error: error.message,
    });
    console.error("Email send failed:", error);
    if (error instanceof PermanentEmailError) {
      throw new NonRetriableError(`Email send failed: ${error.message}`);
    }
    throw new Error(`Email send failed: ${error.message}`);
  }
}

// Add the Inngest trigger function
export const sendPreviewEmailTrigger = inngest.createFunction(
  { 
    id: "send-preview-email",
    name: "Send Book Preview Email",
    priority: {
      run: "100",
    },
    concurrency: {
      limit: 5,
    }
  },
  { event: "book/preview.email.requested" },
  async ({ event, step }) => {
    const { userEmail, token, orderId, bookId } = event.data;
    return await sendPreviewEmail({ userEmail, token, orderId, bookId });
  }
);
