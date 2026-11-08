import { supabaseSecretKey, supabaseUrl } from '@/lib/supabase-server-env'
import { createClient } from "@supabase/supabase-js";
import { createElement } from 'react';
import { inngest } from "../client";
import { NonRetriableError } from 'inngest';
import { ResendPreviewTemplate } from '@/components/email-templates/ResendPreviewTemplate';
import { EMAIL_FROM_UPDATES, EMAIL_REPLY_TO_SUPPORT, PermanentEmailError, sendEmail } from '@/lib/email';
import { notifyPdfSentForApproval, notifyOrderUpdate } from '@/lib/slack';

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseSecretKey);

// Reusing the same email log structure
interface EmailLog {
  orderId: string;
  bookId: string;
  userEmail: string;
  token: string;
  status: "pending" | "sent" | "failed";
  messageId?: string;
  error?: string;
  type: "preview" | "resend_preview";
}

// Updated log function to include type
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
      email_type: log.type,
    });
  if (error) {
    console.error(`Failed to log ${log.type} email send:`, error);
  }
}

interface SendEmailParams {
  userEmail: string;
  token: string;
  orderId: string;
  bookId: string;
}

// Function to send the re-preview email
export async function resendPreviewEmailForApproval({
  userEmail,
  token,
  orderId,
  bookId,
}: SendEmailParams) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://www.example.com");
  const previewUrl = `${baseUrl}/preview?token=${token}`;

  await logEmailSend({
    orderId,
    bookId,
    userEmail,
    token,
    status: "pending",
    type: "resend_preview",
  });

  // Get order data and character data for notification
  let customerName = '';
  let characterName = '';
  
  try {
    const [{ data: order }, { data: bookData }] = await Promise.all([
      supabase
        .from("orders")
        .select("customer_name")
        .eq("id", orderId)
        .single(),
      supabase
        .from("books")
        .select("name")
        .eq("id", bookId)
        .single()
    ]);

    customerName = order?.customer_name || '';
    characterName = bookData?.name || '';
  } catch (error) {
    console.error(`Failed to fetch customer/character data for order ${orderId}:`, error);
  }

  // Send event to trigger resend SMS - wrap in try/catch
  try {
    await inngest.send({
      name: "book/preview.sms.resend.requested",
      data: { orderId, token },
    });
     console.log(`Resend SMS request event sent for order ${orderId}`);
  } catch (error) {
    console.error(`Failed to send resend SMS request event for order ${orderId}:`, error);
     // Log error, but continue with email sending
  }

  try {
    const emailResponse = await sendEmail({
      from: EMAIL_FROM_UPDATES,
      to: userEmail,
      subject: "Your Updated Book Preview is Ready!",
      react: createElement(ResendPreviewTemplate, { previewUrl }),
      replyTo: EMAIL_REPLY_TO_SUPPORT,
    });

    await logEmailSend({
      orderId,
      bookId,
      userEmail,
      token,
      status: "sent",
      messageId: emailResponse.id,
      type: "resend_preview",
    });

    // Send Slack notification that PDF was resent for approval
    try {
      await notifyPdfSentForApproval({
        bookId,
        orderId,
        customerEmail: userEmail,
        customerName,
        characterName,
        token,
        smsAlsoSent: true, // SMS is always triggered for resend
        isResend: true
      });
    } catch (notificationError) {
      console.error('Failed to send PDF resent notification to Slack:', notificationError);
      // Don't throw - notification failure shouldn't break email sending
    }
    try {
      await notifyOrderUpdate({ orderId, bookId, message: 'PDF retriggered and resent' })
    } catch (notificationError) {
      console.error('Failed to send order update notification to Slack:', notificationError);
    }
    console.log("Resend preview email sent successfully to [omitted] for book [omitted]");
    return emailResponse;
  } catch (error: any) {
    await logEmailSend({
      orderId,
      bookId,
      userEmail,
      token,
      status: "failed",
      error: error.message,
      type: "resend_preview",
    });
    console.error("Resend preview email failed for [omitted] (book [omitted]):");
    if (error instanceof PermanentEmailError) {
      throw new NonRetriableError(`Resend preview email send failed: ${error.message}`);
    }
    throw new Error(`Resend preview email send failed: ${error.message}`); // Re-throw for Inngest retry
  }
}

// Add the Inngest trigger function
export const resendPreviewEmailTrigger = inngest.createFunction(
  {
    id: "resend-preview-email",
    name: "Resend Book Preview Email", // Add descriptive name
    priority: {
      run: "100",
    },
    concurrency: {
      limit: 5,
    },
  },
  { event: "book/preview.email.resend.requested" },
  async ({ event, step }) => { // step is not directly needed here
    const { userEmail, token, orderId, bookId } = event.data;
    console.log(`Received event to resend preview email for book: ${bookId}, order: ${orderId}`);
    // Directly call the function
    return await resendPreviewEmailForApproval({ userEmail, token, orderId, bookId });
  }
);
