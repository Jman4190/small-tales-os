// /inngest/client.ts
import { Inngest, EventSchemas } from "inngest";

type BookEvents = {
  "stripe/checkout.completed": {
    data: {
      metadata: {
        bookId: string;
        orderId: string;
      };
    };
  };
  "book/image.generate": {
    data: {
      bookId: string;
      gender: string;
      originalImageUrl: string;
      name: string;
      age: number;
      appearance?: {
        skinTone?: string;
        hair?: string;
        eyeColor?: string;
      };
    };
  };
  "book/preview.email.requested": {
    data: {
      userEmail: string;
      token: string;
      orderId: string;
      bookId: string;
    };
  };
  // Gelato webhook events
  "gelato/order_status_updated": {
    data: {
      orderId: string;
      email: string;
      status: string;
      itemId: string;
      shippingProvider?: string;
      trackingNumber?: string;
      trackingUrl?: string;
      gelatoOrderId?: string;
      fulfillmentCountry?: string;
      allItems?: Array<{
        itemReferenceId: string;
        fulfillmentStatus: string;
        fulfillments?: Array<{
          trackingCode: string;
          trackingUrl: string;
          shipmentMethodName: string;
          shipmentMethodUid: string;
          fulfillmentCountry: string;
          fulfillmentStateProvince: string;
          fulfillmentFacilityId: string;
        }>;
      }>;
    };
  };
  "book/pdf.regenerate.requested": {
    data: {
      bookId: string;
      orderId: string;
    };
  };
  "internal/pdf.regenerated.notification": {
    data: {
      bookId: string;
      orderId: string;
      pdfUrl: string;
    };
  };
  "book/preview.email.resend.requested": {
    data: {
      userEmail: string;
      token: string;
      orderId: string;
      bookId: string;
    };
  };
  // Add new SMS event types here
  "book/preview.sms.requested": {
    data: {
      orderId: string;
      token: string;
    };
  };
  "book/preview.sms.resend.requested": {
    data: {
      orderId: string;
      token: string;
    };
  };
};

// Create a client to send and receive events
export const inngest = new Inngest({
  id: "small-tales",
  schemas: new EventSchemas().fromRecord<BookEvents>(),
  eventKey: process.env.INNGEST_EVENT_KEY,
}); 