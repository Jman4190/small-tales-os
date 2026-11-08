import { readBoundedJsonObject, BodyLimitError } from '@/lib/request-body';
import { supabaseSecretKey, supabaseUrl } from '@/lib/supabase-server-env'
// app/api/verify-image/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { uploadToFal } from "@/lib/falStorage";
import { createClient } from "@supabase/supabase-js";
import { notifySlack } from "@/lib/slack";
import { logBookEvent } from "@/lib/book-logger";
import { trackImageVerification } from "@/lib/posthog-tracker";
import { guardPublicRequest, guardAiBudget } from '@/lib/request-security';
import { grantAccess, isUploadPath, readGrant, verifiedAppearance } from '@/lib/guest-access';

interface VerificationResult {
  passes: boolean;
  failureReason?: string;
  appearance?: {
    skinTone: string;
    hair: string;
    eyeColor: string;
  };
}

const supabase = createClient(
  supabaseUrl,
  supabaseSecretKey
);

fal.config({
  credentials: process.env.FAL_KEY,
});

function stripCodeFences(text: string): string {
  // Remove ``` optionally followed by a language identifier and line break at start,
  // and remove trailing line break and ```
  return text
    .replace(/^```(?:json)?\s*\n/, "")
    .replace(/\n```$/, "")
    .trim();
}

function stripThinkTags(text: string): string {
  if (text.includes('</think>')) {
    const jsonPart = text.split('</think>')[1].trim();
    return jsonPart;
  }
  
  return text;
}

export async function POST(req: NextRequest) {
  const denied = await guardPublicRequest(req, 'verify-image');
  if (denied) return denied;

  let requestData: { filePath?: string; bookId?: string } = {};

  try {
    requestData = await readBoundedJsonObject(req);
    const { filePath, bookId } = requestData;
    if (!isUploadPath(filePath) || !readGrant(req, 'upload', filePath)) {
      return NextResponse.json({ error: 'Upload access required' }, { status: 403 });
    }
    const budgetDenied = await guardAiBudget('verify-image');
    if (budgetDenied) return budgetDenied;
    // Log filePath
    console.log("Creating signed URL for filePath:");

    const relativePath = filePath.includes('/storage/v1/object/public/book-photos/')
      ? filePath.split('/storage/v1/object/public/book-photos/')[1]
      : filePath;
    
    console.log("Using relative path: [omitted]");

    const { data, error } = await supabase.storage
      .from('book-photos')
      .createSignedUrl(relativePath, 3600, {
        download: true
      });

    if (error) {
      console.error("Failed to create signed URL:", error);
      await notifySlack({
        error: "Failed to create signed URL directly",
        filePath,
        additionalContext: { 
          supabaseError: error,
          timestamp: new Date().toISOString()
        }
      });
      throw new Error('Failed to create signed URL');
    }

    const signedUrl = data?.signedUrl;
    if (!signedUrl) {
      const error = "No signed URL returned from Supabase";
      console.error("Image processing update");
      await notifySlack({
        error,
        filePath,
        additionalContext: { timestamp: new Date().toISOString() }
      });
      throw new Error(error);
    }

    console.log("Obtained signedUrl:");

    let falImageUrl: string;
    try {
      // Fetch the image from the signed URL
      const imageResponse = await fetch(signedUrl);
      if (!imageResponse.ok) {
        throw new Error('Failed to fetch image from signed URL');
      }
      const imageBlob = await imageResponse.blob();

      const imageFile = new File([imageBlob], 'image.jpg', { type: imageBlob.type });

      falImageUrl = await uploadToFal(imageFile);
      console.log("Uploaded image to Fal storage:");
    } catch (uploadError) {
      if (uploadError instanceof Error && uploadError.name === 'ApiError') {
        const apiError = uploadError as any; // Type as any to access ApiError properties
        console.error('verify-image uploadToFal error', {
          status: apiError.status,
          data: apiError.response?.data,   // ← usually contains `type`, `msg`, `ctx`
          message: apiError.message,
          name: apiError.name
        });
      } else {
        console.error("Failed to upload image to Fal:", uploadError);
      }
      throw uploadError;
    }

    const falResponse = await fal.subscribe("fal-ai/bagel/understand", {
      input: {
        image_url: falImageUrl,
        prompt: `Analyze this image and verify:
1. It contains exactly one person's face.
2. The person is not wearing a hat.
3. The image is not pornographic.

Additionally, determine the following appearance details in objective terms:
- skinTone: A description of the visible skin tone.
- hair: A description of the hair's color and length ONLY. Do not include style or other details.
- eyeColor: A description of the eye color.

Return your response as valid JSON with this exact structure (no additional text or formatting):
{
  "passes": boolean,
  "failureReason": string|null,
  "appearance": {
    "skinTone": string,
    "hair": string,
    "eyeColor": string
  }
}`
      },
      logs: false,
    });

    console.log("Raw Fal response:");
    const aiMessageText = falResponse.data?.text;
    if (!aiMessageText) {
      const error = "Missing text content in Fal response";
      console.error("Image processing update");
      await notifySlack({
        error,
        filePath,
        additionalContext: { 
          falResponse,
          timestamp: new Date().toISOString()
        }
      });
      throw new Error(error);
    }
    console.log("Fal response content:");

    let verificationResult: VerificationResult = { passes: true };
    let cleanedText = aiMessageText;
    
    cleanedText = stripThinkTags(cleanedText);
    
    if (cleanedText.startsWith("```")) {
      cleanedText = stripCodeFences(cleanedText);
    }
    
    console.log("Cleaned Fal JSON:");
    
    try {
      verificationResult = JSON.parse(cleanedText) as VerificationResult;
    } catch (jsonErr: unknown) {
      console.error("JSON.parse error for Fal response. Cleaned text:");
      await notifySlack({
        error: "Failed to parse Fal response",
        filePath,
        additionalContext: { 
          cleanedText,
          jsonError: jsonErr instanceof Error ? jsonErr.message : String(jsonErr),
          timestamp: new Date().toISOString()
        }
      });
      
      // Log the JSON parsing error
      logBookEvent(bookId || null, "image_verification_error", {
        error: "JSON parsing error",
        filePath,
        rawResponse: cleanedText
      });
      
      // Return a user-friendly error instead of throwing the JSON parse error
      return NextResponse.json(
        {
          success: false,
          error: "Oops, something went wrong. Please try again.",
        },
        { status: 500 }
      );
    }

    const safeAppearance = verifiedAppearance(verificationResult.appearance);
    if (typeof verificationResult.passes !== 'boolean' || (verificationResult.passes && !safeAppearance)) {
      return NextResponse.json({ success: false, error: 'Unable to verify the photo details. Please try again.' }, { status: 502 });
    }
    if (safeAppearance) verificationResult.appearance = safeAppearance;

    console.log("Appearance details:");

    // Add verification failure notification
    if (!verificationResult.passes) {
      await notifySlack({
        error: "Image verification failed",
        failureReason: verificationResult.failureReason || "No specific reason provided",
        filePath,
        additionalContext: {
          appearance: verificationResult.appearance,
          timestamp: new Date().toISOString()
        }
      });
      
      // Log verification failure
      logBookEvent(bookId || null, "image_verification_failed", {
        filePath,
        failureReason: verificationResult.failureReason || "No specific reason provided",
        appearance: verificationResult.appearance
      });
      
      trackImageVerification({
        bookId: bookId || undefined,
        filePath,
        passes: false,
        failureReason: verificationResult.failureReason,
        appearance: verificationResult.appearance
      }).catch(err => console.error('Failed to track image verification:', err));
    } else {
      // Log successful verification
      logBookEvent(bookId || null, "image_verification_success", {
        filePath,
        appearance: verificationResult.appearance
      });
      
      trackImageVerification({
        bookId: bookId || undefined,
        filePath,
        passes: true,
        appearance: verificationResult.appearance
      }).catch(err => console.error('Failed to track image verification:', err));
    }

    const response = NextResponse.json({ success: true, ...verificationResult });
    if (verificationResult.passes && safeAppearance) {
      return grantAccess(response, 'verified-upload', filePath, safeAppearance);
    }
    return response;
  } catch (error) {
    if (error instanceof BodyLimitError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Error verifying image:", error);

    let parsedError: any = { message: "Unknown error verifying image with Fal" };
    
    // Handle ApiError specifically
    if (error instanceof Error && error.name === 'ApiError') {
      const apiError = error as any;
      console.error('verify-image ApiError details', {
        status: apiError.status,
        data: apiError.response?.data,   // ← usually contains `type`, `msg`, `ctx`
        message: apiError.message,
        name: apiError.name
      });
      parsedError = {
        message: apiError.message || `API Error ${apiError.status}`,
        status: apiError.status,
        type: apiError.response?.data?.type,
        details: apiError.response?.data
      };
    } else if (error instanceof Error && error.message) {
      try {
        parsedError = JSON.parse(error.message);
      } catch {
        parsedError = { message: error.message };
      }
    }

    await notifySlack({
      error: JSON.stringify(parsedError),
      filePath: requestData.filePath,
      additionalContext: {
        timestamp: new Date().toISOString(),
        stack: error instanceof Error ? error.stack : undefined
      }
    });

    // Log the error
    logBookEvent(requestData.bookId || null, "image_verification_error", {
      error: parsedError.message,
      filePath: requestData.filePath,
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json(
      {
        success: false,
        error: "Unable to verify the image. Please try again.",
      },
      { status: 500 }
    );
  }
}
