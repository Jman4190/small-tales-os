import { supabaseSecretKey, supabaseUrl } from '@/lib/supabase-server-env'
// /inngest/functions/createBookImage.ts
import { inngest } from "../client";
import { createClient } from "@supabase/supabase-js";
import { Step } from "inngest";
import { uploadImage, generateImage, retrieveGeneratedImage } from "@/utils/leonardo";
import { trackBookPreviewGeneration } from "@/lib/posthog-tracker";
import { log } from "@/lib/logger";
import { notifySlack, notifyLeonardoFailure } from "@/lib/slack";

const supabase = createClient(
  supabaseUrl,
  supabaseSecretKey
);

const LEONARDO_BASE_URL = "https://cloud.leonardo.ai/api/rest/v1";

async function uploadImageToLeonardo(filePath: string) {
  console.log("📤 Starting Leonardo upload for:");
  try {
    // Step 1: Get a presigned URL from Leonardo
    const initResponse = await fetch(`${LEONARDO_BASE_URL}/init-image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.LEONARDO_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ extension: 'jpg' })
    });

    if (!initResponse.ok) {
      const errorText = await initResponse.text();
      console.error("Leonardo init response error:");
      throw new Error(`Failed to get presigned URL: ${errorText}`);
    }

    const presignedData = await initResponse.json();
    console.log("Got presigned data:");
    
    const { url, fields, id: uploadedImageId } = presignedData.uploadInitImage;
    console.log("📝 Got uploadedImageId:", uploadedImageId);

    const formData = new FormData();

    // Add the presigned fields
    Object.entries(JSON.parse(fields)).forEach(([key, value]) => {
      formData.append(key, value as string);
    });

    // Get the image from Supabase - handle both full paths and relative paths
    const bucketPath = filePath.includes('book-photos/') 
      ? filePath.replace('book-photos/', '') 
      : filePath;

    const { data: signedUrlData, error } = await supabase.storage
      .from('book-photos')
      .createSignedUrl(bucketPath, 3600);

    if (error || !signedUrlData?.signedUrl) {
      console.error('Supabase signed URL error:', error);
      throw new Error('Failed to retrieve signed URL from Supabase');
    }

    // Get the file from Supabase and add it to formData
    const fileResponse = await fetch(signedUrlData.signedUrl);
    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch image from Supabase: ${fileResponse.statusText}`);
    }

    const blob = await fileResponse.blob();
    formData.append('file', blob);

    // Upload to Leonardo's S3
    const uploadResponse = await fetch(url, {
      method: 'POST',
      body: formData
    });

    if (uploadResponse.status !== 204) {
      throw new Error(`Failed to upload image to Leonardo: ${await uploadResponse.text()}`);
    }

    console.log("✅ Successfully uploaded to Leonardo, returning ID:", uploadedImageId);
    return uploadedImageId;
  } catch (error) {
    console.error('❌ Leonardo Upload Error:', error);
    throw error;
  }
}

async function startImageGeneration(
  imageUrl: string, 
  gender: string, 
  age: number, 
  appearance?: { 
    skinTone?: string; 
    hair?: string; 
    eyeColor?: string;
  },
  variant?: {
    prompt?: string;
    contentImagePath?: string;
    styleImagePath?: string;
    poseImagePath?: string;
  }
) {
  console.log("🎨 Starting image generation with appearance details:");

  try {
    // Upload all images in parallel
    const [characterId, contentId, styleId, poseId] = await Promise.all([
      uploadImage(imageUrl),
      uploadImage(variant?.contentImagePath || 'book-photos/cover_image/cover-image-small-tales.jpg'),
      uploadImage(variant?.styleImagePath || 'book-photos/cover_image/cover-image-small-tales.jpg'),
      uploadImage(variant?.poseImagePath || 'book-photos/cover_image/cover-image-small-tales.jpg')
    ]);

    console.log("✅ All images uploaded with IDs:", { characterId, contentId, styleId, poseId });

    const defaultPrompt = `A ${age} year old ${gender} with ${appearance?.skinTone || 'default'} skin, ${appearance?.hair || 'default hair'} hair, and ${appearance?.eyeColor || 'default'} eyes, holding beans in their hands, perfect teeth,perfect smile, illustration style`;
    const prompt = variant?.prompt || defaultPrompt;

    // Generate the image
    const generationId = await generateImage(
      characterId,
      contentId,
      styleId,
      poseId,
      prompt,
      {
        characterStrength: "High",
        contentStrength: "Mid",
        styleStrength: "Mid",
        poseWeight: 1.0
      }
    );

    return generationId;
  } catch (error) {
    console.error("Error in startImageGeneration:", error);
    throw error;
  }
}

async function pollImageStatus(generationId: string) {
  console.log("Polling status for generation:", generationId);
  let attempts = 0;
  const maxAttempts = 60;
  const delayMs = 5000;

  while (attempts < maxAttempts) {
    try {
      const imageUrl = await retrieveGeneratedImage(generationId);
      if (imageUrl) {
        console.log(`✅ Generation ${generationId} completed after ${attempts + 1} attempts`);
        return imageUrl;
      }
      console.log(`⏳ Generation ${generationId} not ready yet (attempt ${attempts + 1}/${maxAttempts})`);
    } catch (error) {
      console.error(`Error polling generation ${generationId}:`, error);
      return null;
    }

    attempts++;
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  console.warn(`⚠️ Generation ${generationId} timed out after ${maxAttempts} attempts`);
  return null;
}

// Update the interface to match the actual data structure
interface BookImageGenerationData {
  bookId: string;
  originalImageUrl: string;
  gender: "boy" | "girl";
  age: number;
  name: string;
  appearance?: {
    skinTone?: string;
    hair?: string;
    eyeColor?: string;
  };
}

// Add type declaration for step.runParallel
declare module "inngest" {
  interface Step {
    runParallel<T>(fns: Array<() => Promise<T>>): Promise<T[]>;
  }
}

export const createBookImage = inngest.createFunction(
  { 
    id: "generate-preview-images",
    priority: {
      run: "600", // Maximum priority (600 seconds)
    },
    concurrency: {
      limit: 5, // Limit to 5 concurrent executions to avoid overwhelming Leonardo API
    }
  },
  { event: "book/image.generate" },
  async ({ event, step }) => {
    const { bookId } = event.data;
    const startTime = Date.now();

    try {
      // Initial status update
      await step.run("Update Initial Status", async () => {
        console.log("📝 Setting initial status to processing", { bookId });
        const { data, error } = await supabase
          .from("books")
          .update({ status: "processing" })
          .eq("id", bookId)
          .select()
          .single();

        if (error) {
          console.error("❌ Failed to update initial status:", { error, bookId });
          throw error;
        }
        console.log("✅ Initial status updated", { 
          bookId, 
          newStatus: data.status 
        });
      });

      // Generate 3 images in parallel with different variants
      console.log("🎨 Starting parallel image generation for 3 images");
      
      const variants = [
        undefined, // Default variant
        {
          prompt: `A ${event.data.age} year old ${event.data.gender} with ${event.data.appearance?.skinTone || 'default'} skin, ${event.data.appearance?.hair || 'default'} hair, and ${event.data.appearance?.eyeColor || 'default'} eyes, dressed in a firefighter suit, stands proudly in front of a smoky, charred house, with a fluffy kitten on one shoulder and a cute puppy perched on their other shoulder, perfect smile, perfect teeth, illustration style`,
          contentImagePath: 'book-photos/book_images/page_8_firefighter.jpg',
          styleImagePath: 'book-photos/book_images/page_8_firefighter.jpg',
          poseImagePath: 'book-photos/book_images/page_8_firefighter.jpg'
        },
        {
          prompt: `A ${event.data.age} year old ${event.data.gender} with ${event.data.appearance?.skinTone || 'default'} skin, ${event.data.appearance?.hair || 'default'} hair, and ${event.data.appearance?.eyeColor || 'default'} eyes, sits confidently on the surface of the moon in a pristine astronaut suit, they are clutching a delicate china teacup, surrounded by a meticulously arranged display of china tea ware and a slice of cake on a plate, perfect smile, perfect teeth, illustration style`,
          contentImagePath: 'book-photos/book_images/page_5_astronaut.jpg',
          styleImagePath: 'book-photos/book_images/page_5_astronaut.jpg',
          poseImagePath: 'book-photos/book_images/page_5_astronaut.jpg'
        }
      ];

      // Start Leonardo generation for 3 images in parallel
      console.log("🎨 Starting parallel image generation for 3 images");
      
      const [genId1, genId2, genId3] = await Promise.all([
        step.run("Generate Image 1", () => 
          startImageGeneration(
            event.data.originalImageUrl, 
            event.data.gender, 
            event.data.age, 
            event.data.appearance,
            variants[0]
          )
        ),
        step.run("Generate Image 2", () => 
          startImageGeneration(
            event.data.originalImageUrl, 
            event.data.gender, 
            event.data.age, 
            event.data.appearance,
            variants[1]
          )
        ),
        step.run("Generate Image 3", () => 
          startImageGeneration(
            event.data.originalImageUrl, 
            event.data.gender, 
            event.data.age, 
            event.data.appearance,
            variants[2]
          )
        )
      ]);
      
      console.log("✅ Generation IDs for each image:", {
        image1: genId1,
        image2: genId2,
        image3: genId3
      });

      // Poll for completion of all 3 images in parallel
      const [url1, url2, url3] = await Promise.all([
        step.run("Poll Image 1", () => pollImageStatus(genId1)),
        step.run("Poll Image 2", () => pollImageStatus(genId2)),
        step.run("Poll Image 3", () => pollImageStatus(genId3))
      ]);
      
      console.log("✅ Raw polling results:", {
        url1,
        url2,
        url3,
        isUrl1Valid: Boolean(url1),
        isUrl2Valid: Boolean(url2),
        isUrl3Valid: Boolean(url3)
      });
      
      const imageUrls = [url1, url2, url3].filter(Boolean) as string[];
      if (imageUrls.length === 0) {
        console.error("❌ No valid image URLs were generated");
        throw new Error("Image generation failed - no valid URLs returned");
      }

      console.log("✅ Filtered valid image URLs:");
      
      // Final status update
      await step.run("Update Final Status", async () => {
        console.log("📝 Preparing final status update");
        
        // First check current status to avoid race conditions
        const { data: currentBook, error: fetchError } = await supabase
          .from("books")
          .select("status, generated_image_url, generated_image_urls")
          .eq("id", bookId)
          .single();

        if (fetchError) {
          console.error("❌ Failed to fetch current book status:", { 
            error: fetchError,
            bookId 
          });
          throw fetchError;
        }

        // Only update if not already completed
        if (currentBook.status === "completed" && currentBook.generated_image_urls?.length > 0) {
          console.log("⚠️ Book already completed with images, skipping update");
          return;
        }

        const updateData = {
          generated_image_url: imageUrls[0],
          generated_image_urls: imageUrls,
          status: "completed"
        };

        console.log("📝 Update payload:");
        
        const { data, error } = await supabase
          .from("books")
          .update(updateData)
          .eq("id", bookId)
          .eq("status", "processing") // Only update if still processing
          .select()
          .single();

        if (error) {
          console.error("❌ Failed to update final status:");
          throw error;
        }

        console.log("✅ Final status updated successfully");
      });

      console.log("🏁 CREATE BOOK IMAGE FUNCTION COMPLETED");

      const endTime = Date.now();
      const durationMs = endTime - startTime;
      
      trackBookPreviewGeneration({
        bookId,
        name: event.data.name,
        gender: event.data.gender,
        age: event.data.age,
        durationMs,
        generatedImageUrls: imageUrls,
        appearance: event.data.appearance
      }).catch(err => console.error('Failed to track book preview generation:', err));

      return { success: true, imageUrls };
    } catch (error) {
      const logContext = { bookId, function: 'createBookImage' };
      
      log('error', `Create book image function failed`, { 
        ...logContext, 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Send comprehensive Slack notification for function-level failures
      await notifySlack({
        error: `Create book image function failed`,
        failureReason: error instanceof Error ? error.message : String(error),
        additionalContext: {
          bookId,
          function: 'createBookImage',
          errorStack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        }
      });
      
      const { data, error: updateError } = await supabase
        .from("books")
        .update({ status: "failed" })
        .eq("id", bookId)
        .select()
        .single();

      if (updateError) {
        log('error', `Failed to update book status to failed`, { 
          ...logContext, 
          updateError: updateError.message 
        });
      } else {
        log('info', `Book status updated to failed`, { 
          ...logContext, 
          newStatus: data.status 
        });
      }
      
      throw error;
    }
  }
);  