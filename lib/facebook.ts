import crypto from 'crypto';

// Helper function to hash data using SHA256
function hashData(data: string | null | undefined): string | null {
  if (!data) {
    return null;
  }
  return crypto.createHash('sha256').update(data.toLowerCase()).digest('hex');
}

// Interface for the Purchase event payload structure (subset relevant to us)
interface FacebookUserData {
  em?: string[]; // Hashed Email
  ph?: string[]; // Hashed Phone (Optional, not sending yet)
  fn?: string[]; // Hashed First Name
  ln?: string[]; // Hashed Last Name
  external_id?: string[]; // Unique ID from your system (Hashed)
  client_ip_address?: string; // Optional
  client_user_agent?: string; // Optional, DO NOT HASH
  fbc?: string; // Optional
  fbp?: string; // Optional
}

interface FacebookCustomData {
  currency?: string; // Uppercase currency code (e.g., "USD")
  value?: number; // Purchase value
}

interface FacebookPurchaseEvent {
  event_name: 'Purchase';
  event_time: number; // Unix timestamp (seconds)
  action_source: 'website' | 'app' | 'offline' | 'chat' | 'physical_store' | 'other';
  event_source_url?: string; // URL where event occurred
  user_data: FacebookUserData;
  custom_data: FacebookCustomData;
  event_id?: string; // Optional: Unique ID for deduplication
}

interface FacebookApiPayload {
  data: FacebookPurchaseEvent[];
  test_event_code?: string; // Optional: For testing
}

// Function to send the Purchase event
export async function sendFacebookPurchaseEvent(
    session: {
        customer_details?: { email?: string | null; name?: string | null; phone?: string | null } | null;
        amount_total?: number | null;
        currency?: string | null;
    },
    orderId: string, // Using our internal order ID as external_id
    userAgent: string | null // Add userAgent parameter
): Promise<void> {
  const pixelId = process.env.FACEBOOK_PIXEL_ID;
  const accessToken = process.env.FACEBOOK_CONVERSION_API_ACCESS_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!pixelId || !accessToken) {
    console.warn('Facebook Pixel ID or Access Token missing. Skipping CAPI event.');
    return;
  }

  try {
    const eventTime = Math.floor(Date.now() / 1000);
    const email = session.customer_details?.email;
    const name = session.customer_details?.name;
    let firstName = null;
    let lastName = null;

    if (name) {
      const nameParts = name.trim().split(/\s+/);
      firstName = nameParts[0];
      if (nameParts.length > 1) {
        lastName = nameParts.slice(1).join(' ');
      }
    }

    const hashedEmail = hashData(email);
    const hashedFirstName = hashData(firstName);
    const hashedLastName = hashData(lastName);
    // Hash the orderId to use as external_id
    const hashedExternalId = hashData(orderId);

    const userData: FacebookUserData = {};
    if (hashedEmail) userData.em = [hashedEmail];
    if (hashedFirstName) userData.fn = [hashedFirstName];
    if (hashedLastName) userData.ln = [hashedLastName];
    if (hashedExternalId) userData.external_id = [hashedExternalId];
    if (userAgent) userData.client_user_agent = userAgent; // Add userAgent if present (do not hash)

    const customData: FacebookCustomData = {
      currency: session.currency?.toUpperCase() || 'USD',
      // Ensure value is a number and correctly formatted (e.g., dollars)
      value: session.amount_total ? session.amount_total / 100 : 0,
    };

    const eventPayload: FacebookPurchaseEvent = {
      event_name: 'Purchase',
      event_time: eventTime,
      action_source: 'website',
      // Use the app's base URL as the source URL for server-side events
      event_source_url: appUrl || undefined,
      user_data: userData,
      custom_data: customData,
      // Unique event ID for deduplication between client and server events
      event_id: `purchase_${orderId}`
    };

    const payload: FacebookApiPayload = {
      data: [eventPayload],
      // Add test_event_code here if testing:
      // test_event_code: process.env.FACEBOOK_TEST_EVENT_CODE
    };

    const formData = new FormData();
    formData.append('data', JSON.stringify(payload.data));
    formData.append('access_token', accessToken);
    if (payload.test_event_code) {
       formData.append('test_event_code', payload.test_event_code);
    }

    const url = `https://graph.facebook.com/v20.0/${pixelId}/events`; // Using v20.0 as a recent stable version

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    const responseBody = await response.json();

    if (!response.ok) {
      console.error(
        'Facebook CAPI Error:',
        response.status,
        response.statusText,
        responseBody
      );
    } else {
      console.log('Facebook CAPI Purchase event sent successfully:', responseBody);
    }
  } catch (error) {
    console.error('Failed to send Facebook CAPI Purchase event:', error);
    // Important: Don't re-throw here, log the error but let webhook succeed.
  }
} 