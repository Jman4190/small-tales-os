// /lib/twilio.ts
async function createTwilioClient() {
  const { default: twilio } = await import('twilio');
  return twilio(
    process.env.TWILIO_API_KEY_SID!,
    process.env.TWILIO_API_KEY_SECRET!,
    { accountSid: process.env.TWILIO_ACCOUNT_SID! }
  );
}

// Renamed from sendOrderSms and generalized
export async function sendSms(to: string, body: string) {
  if (!to) {
    console.log("No phone number provided, skipping SMS.");
    return; // Nothing to send
  }
  if (!process.env.TWILIO_PHONE_NUMBER) {
    console.error("Twilio phone number not configured.");
    return; // Cannot send
  }

  try {
    const client = await createTwilioClient();
    await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER, // your Twilio-verified number
      to, // must be in E.164 format
    });
    console.log(`SMS sent successfully to ${to}`);
  } catch (error) {
    console.error(`Failed to send SMS to ${to}:`, error);
    // We log the error but don't throw, as per requirements
  }
}
