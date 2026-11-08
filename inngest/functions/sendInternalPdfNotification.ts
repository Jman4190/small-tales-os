import { inngest } from "../client";
import { NonRetriableError } from 'inngest';
import { EMAIL_FROM_UPDATES, PermanentEmailError, sendEmail } from '@/lib/email';

export const sendInternalPdfNotificationTrigger = inngest.createFunction(
  {
    id: "send-internal-pdf-notification",
    name: "send-internal-pdf-notification",
    concurrency: 5 // Allow a few concurrent emails
  },
  { event: "internal/pdf.regenerated.notification" },
  async ({ event, step }) => {
    const { bookId, orderId, pdfUrl } = event.data;
    const internalNotificationEmail = process.env.ADMIN_NOTIFICATION_EMAIL;

    if (!internalNotificationEmail) {
      throw new Error("ADMIN_NOTIFICATION_EMAIL is not configured");
    }

    console.log(`📨 Received internal/pdf.regenerated.notification event`, { bookId, orderId });

    console.log(`📧 Preparing internal notification email for bookId: ${bookId}, orderId: ${orderId} to ${internalNotificationEmail}`);

    const subject = `PDF Regenerated for Order ${orderId} / Book ${bookId}`;
    const body = `
      <p>A PDF has been regenerated for Small Tales Order ID: ${orderId}</p>
      <p>Book ID: ${bookId}</p>
      <p>You can download the regenerated PDF here: <a href="${pdfUrl}">${pdfUrl}</a></p>
      <p>This PDF has <strong>not</strong> been sent to the customer or updated in the order details automatically.</p>
    `;

    try {
      await step.run("send-internal-email", async () => {
        console.log(`📤 Attempting to send email to ${internalNotificationEmail}`);
        let result;
        try {
          result = await sendEmail({
            from: EMAIL_FROM_UPDATES,
            to: internalNotificationEmail,
            subject: subject,
            html: body,
          });
        } catch (error) {
          if (error instanceof PermanentEmailError) {
            throw new NonRetriableError(error.message);
          }
          throw error;
        }

        console.log(`✅ Internal notification email sent successfully, ID: ${result.id}`);
        return { emailId: result.id };
      });

    } catch (error: any) {
      console.error(`❌ Failed to send internal notification email:`, error);
      // Throw the error so Inngest retries the function
      throw error;
    }

    console.log(`✅ Internal notification processed for bookId: ${bookId}, orderId: ${orderId}`);
    return { success: true, bookId, orderId };
  }
);
