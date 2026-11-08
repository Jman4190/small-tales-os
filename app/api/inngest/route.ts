import { serve } from "inngest/next";
import { NextRequest } from "next/server";
import { readBoundedRequestBody, BodyLimitError } from "@/lib/request-body";
import { assertJsonComplexity, JsonComplexityError } from "@/lib/json-complexity";
import { inngest } from "../../../inngest/client";

console.log("🔧 Inngest route loaded, registering functions...");
import { generateBookImages } from "../../../inngest/functions/generateBookImages";
import { createBookImage } from "../../../inngest/functions/createBookImage";
import { generatePdfTrigger } from "../../../inngest/functions/generatePdfs";
import { sendPreviewEmailTrigger } from "../../../inngest/functions/sendPreviewEmail";
import { sendShippingEmailTrigger } from "../../../inngest/functions/sendShippingEmail";
import { regeneratePdfTrigger } from "../../../inngest/functions/regeneratePdf";
import { sendInternalPdfNotificationTrigger } from "../../../inngest/functions/sendInternalPdfNotification";
import { triggerGelatoOrderFromRegeneration } from "../../../inngest/functions/triggerGelatoOrderFromRegeneration";
import { resendPreviewEmailTrigger } from "../../../inngest/functions/resendPreviewEmail";
// Import the new SMS functions
import { sendPreviewSmsTrigger, resendPreviewSmsTrigger } from "../../../inngest/functions/sendPreviewSms";
import { notifyInngestFailureTrigger } from "../../../inngest/functions/notifyInngestFailure";

const functions = [
  generateBookImages,
  createBookImage,
  generatePdfTrigger,
  sendPreviewEmailTrigger,
  sendShippingEmailTrigger,
  regeneratePdfTrigger,
  sendInternalPdfNotificationTrigger,
  triggerGelatoOrderFromRegeneration,
  resendPreviewEmailTrigger,
  // Add the new SMS functions to the array
  sendPreviewSmsTrigger,
  resendPreviewSmsTrigger,
  notifyInngestFailureTrigger,
];

// Create an API that serves the functions
const handlers = serve({
  client: inngest,
  functions,
  streaming: "allow", // Enable streaming for longer function execution
  signingKey: process.env.INNGEST_SIGNING_KEY,
});

// Inngest sends at most 4 MiB to a serving endpoint. Keep validation of its
// signature inside the SDK, after bounding raw bytes and parsed JSON structure.
const MAX_BODY_BYTES = 4 * 1024 * 1024;

function withBodyLimit(handler: typeof handlers.POST) {
  return async (request: NextRequest, context: unknown) => {
    let body: ArrayBuffer;
    try {
      body = await readBoundedRequestBody(request, MAX_BODY_BYTES);
      if (body.byteLength) {
        // Inspect a copy without re-encoding the bytes covered by the SDK signature.
        let value: unknown;
        try {
          value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
        } catch {
          return Response.json({ error: 'Invalid JSON request body' }, { status: 400 });
        }
        assertJsonComplexity(value);
      }
    } catch (error) {
      if (!(error instanceof BodyLimitError) && !(error instanceof JsonComplexityError)) throw error;
      return Response.json({ error: error.message }, { status: error.status });
    }
    // A hosting adapter can supply a different Request implementation. Passing
    // that object as the constructor input can lose its method and default to GET.
    return handler(new NextRequest(request.url, {
      method: request.method,
      headers: request.headers,
      signal: request.signal,
      body,
    }), context);
  };
}

export const GET = handlers.GET;
export const POST = withBodyLimit(handlers.POST);
export const PUT = withBodyLimit(handlers.PUT);

console.log("🔧 Inngest serve configured with", {
  functionsCount: functions.length,
  hasCreateBookImage: functions.includes(createBookImage),
});

// Use Edge Runtime for better performance
// export const runtime = "edge"; // commenting out for now
