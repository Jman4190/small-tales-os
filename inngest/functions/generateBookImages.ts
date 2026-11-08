import { supabaseSecretKey, supabaseUrl } from '@/lib/supabase-server-env'
import { inngest } from "../client";
import { createClient } from "@supabase/supabase-js";
import { IMAGE_REFERENCES } from "../../config/imageReferences";
import * as leonardo from "../../utils/leonardo";
import { log } from "../../lib/logger";
import { notifySlack, notifyLeonardoFailure, notifyOrderUpdate } from "../../lib/slack";

// Initialize Supabase client directly like in createBookImage.ts
const supabase = createClient(
  supabaseUrl,
  supabaseSecretKey
);

const LEONARDO_BASE_URL = "https://cloud.leonardo.ai/api/rest/v1";

export const generateBookImages = inngest.createFunction(
  {
    id: "generate-book-images",
    priority: {
      run: "300", // Medium priority (300 seconds)
    },
    concurrency: {
      limit: 3, // Limit to 3 concurrent executions
    }
  },
  { event: "stripe/checkout.completed" },
  async ({ event, step }) => {
    const bookId = event.data.metadata?.bookId;
    const orderId = event.data.metadata?.orderId;

    if (!bookId || !orderId) {
      throw new Error("Missing bookId or orderId");
    }

    await notifyOrderUpdate({ orderId, bookId, message: 'generate-book-images started' })

    try {
      // Update initial status
      await step.run("update-initial-status", async () => {
        const { error } = await supabase
          .from("books")
          .update({ status: "processing" })
          .eq("id", bookId);
        if (error) throw error;
      });

      // Fetch book data; include appearance details, name, and pre-generated images
      const bookData = await step.run("fetch-book-data", async () => {
        console.log(`📊 Fetching book data for bookId: ${bookId}`);
        const { data, error } = await supabase
          .from("books")
          .select(
            "name, original_image_url, gender, age, appearance, generated_image_url, generated_image_urls"
          )
          .eq("id", bookId)
          .single();
        if (error) {
          console.error("❌ Error fetching book data: [omitted]");
          throw error;
        }
        console.log("✅ Book data fetched successfully:");
        return data;
      });

      // Upload character image
      const characterId = await step.run("upload-character-image", async () => {
        const logContext = { bookId, orderId, function: 'upload-character-image' };

        try {
          log('info', `Starting character image upload`, {
            ...logContext,
            imageUrl: bookData.original_image_url
          });

          const id = await leonardo.uploadImage(bookData.original_image_url);

          log('info', `Character image uploaded successfully`, {
            ...logContext,
            characterId: id
          });

          return id;
        } catch (error) {
          log('error', `Character image upload failed`, {
            ...logContext,
            error: error instanceof Error ? error.message : String(error),
            imageUrl: bookData.original_image_url
          });

          await notifyLeonardoFailure({
            error: `Character image upload failed for book generation`,
            failureReason: error instanceof Error ? error.message : String(error),
            bookId,
            orderId,
            step: 'upload-character-image',
            additionalContext: {
              originalImageUrl: bookData.original_image_url,
              function: 'generateBookImages'
            }
          });

          throw error;
        }
      });

      // ===== NEW LOGIC: Determine existing images and upsert previews =====
      const initialExistingRows = (await step.run("fetch-existing-photos", async () => {
        const { data, error } = await supabase
          .from("book_photos")
          .select("image_reference_number")
          .eq("book_id", bookId);
        if (error) {
            console.error(`❌ Error fetching initial book_photos:`, error);
            throw error;
        }
        // Ensure data is treated as an array of objects with image_reference_number
        const typedData = data as { image_reference_number: string }[] | null;
        const existingArray = typedData?.map(r => r.image_reference_number) ?? [];
        console.log("✅ Fetched initial [omitted] photos from book_photos:");
        return existingArray; // Return an array instead of a Set
      })) as string[]; // Update type hint to string[]

      // Keep track of rows modified during the upsert step (optional, but can be useful for logging)
      const upsertedInThisRun: string[] = [];

      await step.run("upsert-preview-images", async () => {
        // Log the source array and the specific URLs being used
        console.log("🔍 Checking pre-generated URLs:");

        const previewPairs: Array<[string, string | undefined]> = [
          ["image_8", bookData.generated_image_urls?.[1]], // firefighter
          ["image_5", bookData.generated_image_urls?.[2]], // astronaut
        ];

        let upsertedCount = 0;
        for (const [refNum, url] of previewPairs) {
          if (!url) {
            console.log(`ℹ️ No pre-generated URL found for ${refNum}, skipping upsert.`);
            continue;
          }
          // Only upsert if it wasn't found in the *initial* fetch
          if (!initialExistingRows.includes(refNum)) { // Use includes() instead of has()
            console.log(`💾 Upserting pre-generated URL for ${refNum}`);
            const { error: upsertError } = await supabase
              .from("book_photos")
              .upsert(
                {
                  book_id: bookId,
                  order_id: orderId,
                  image_url: url,
                  image_reference_number: refNum,
                  status: "generated",
                  character_name: bookData.name,
                  character_gender: bookData.gender,
                  reference_image_url: bookData.original_image_url,
                },
                { onConflict: "book_id, image_reference_number" }
              );

            if (upsertError) {
              console.error(`❌ Upsert error for pre-generated ${refNum}:`, upsertError);
              // Decide if this should be a fatal error or just a warning
              // For now, let's throw to be safe, as it might indicate a bigger issue.
              throw upsertError;
            }
            upsertedInThisRun.push(refNum); // Track successful upserts in this run
            upsertedCount++;
            console.log(`✅ Successfully upserted ${refNum}`);
          } else {
             console.log(`ℹ️ ${refNum} already exists in book_photos (found during initial fetch), skipping upsert.`);
          }
        }
         console.log(`✅ Preview image upsert step complete. Attempted upsert for ${upsertedCount} new rows (${upsertedInThisRun.join(', ')}).`);
      });

      // Re-fetch the definitive list of existing photos *after* potential upserts
      const finalExistingRows = (await step.run("refetch-existing-photos", async () => {
        console.log(`🔄 Re-fetching book_photos after upsert attempt...`);
        const { data, error } = await supabase
          .from("book_photos")
          .select("image_reference_number")
          .eq("book_id", bookId);
        if (error) {
          console.error(`❌ Error re-fetching existing book_photos:`, error);
          throw error;
        }
        const typedData = data as { image_reference_number: string }[] | null;
        const existingArray = typedData?.map((r) => r.image_reference_number) ?? [];
        console.log("✅ Found final [omitted] photos in book_photos:");
        return existingArray;
      })) as string[];

      // ===== PHASE 3: Image Generation =====
      // Build the final "to-generate" list using the *re-fetched* list
      const imagesToGenerate = IMAGE_REFERENCES.filter(
        (ref) => !finalExistingRows.includes(ref.image_number) // Use the definitive list
      );

      const skippedCount = IMAGE_REFERENCES.length - imagesToGenerate.length;
      console.log(`🔍 Will generate ${imagesToGenerate.length} images. Skipped ${skippedCount} existing images.`);
      console.log(`📋 Images to generate: ${imagesToGenerate.map(ref => ref.image_number).join(', ') || 'None'}`);
      // Log the final list of rows that were skipped
      console.log(`📋 Images skipped (already exist or pre-generated): ${finalExistingRows.join(', ') || 'None'}`);

      // Generate each image sequentially (only for images that need generation)
      for (const ref of imagesToGenerate) {
        try {
          console.log(`📝 Processing image ${ref.image_number} for generation`);

          // Build appearance description
          const appearanceDesc = bookData.appearance ?
            `with ${bookData.appearance.skinTone} skin, ${bookData.appearance.hair}, and ${bookData.appearance.eyeColor}` :
            '';

          // Replace tokens correctly
          const formattedPrompt = ref.prompt
            .replace("{gender}", bookData.gender)
            .replace("{age}", `${bookData.age}`)
            .replace("{appearance.skinTone}", bookData.appearance?.skinTone || "default")
            .replace("{appearance.hair}", bookData.appearance?.hair || "default")
            .replace("{appearance.eyeColor}", bookData.appearance?.eyeColor || "default");

          // Log the prompt for debugging
          console.log("🎨 Generating image [omitted]:");

          // Upload reference images
          const [contentId, styleId, poseId] = await step.run(
            `upload-reference-images-${ref.image_number}`,
            async () => {
              const logContext = {
                bookId,
                orderId,
                imageNumber: ref.image_number,
                function: `upload-reference-images-${ref.image_number}`
              };

              try {
                log('info', `Starting reference image uploads`, {
                  ...logContext,
                  contentRef: ref.content_ref,
                  styleRef: ref.style_ref,
                  poseRef: ref.pose_ref
                });

                const results = await Promise.all([
                  leonardo.uploadImage(ref.content_ref),
                  leonardo.uploadImage(ref.style_ref),
                  leonardo.uploadImage(ref.pose_ref),
                ]);

                log('info', `Reference images uploaded successfully`, {
                  ...logContext,
                  contentId: results[0],
                  styleId: results[1],
                  poseId: results[2]
                });

                return results;
              } catch (error) {
                log('error', `Reference image uploads failed`, {
                  ...logContext,
                  error: error instanceof Error ? error.message : String(error)
                });

                await notifyLeonardoFailure({
                  error: `Reference image uploads failed for ${ref.image_number}`,
                  failureReason: error instanceof Error ? error.message : String(error),
                  bookId,
                  orderId,
                  imageNumber: ref.image_number,
                  step: `upload-reference-images-${ref.image_number}`,
                  additionalContext: {
                    contentRef: ref.content_ref,
                    styleRef: ref.style_ref,
                    poseRef: ref.pose_ref,
                    function: 'generateBookImages'
                  }
                });

                throw error;
              }
            }
          );

          // Rate limit between generations
          if (ref.image_number !== "image_1") {
            await step.sleep(`rate-limit-${ref.image_number}`, "60s");
          }

          // Generate image using the formatted prompt
          const generationId = await step.run(
            `start-generation-${ref.image_number}`,
            async () => {
              const logContext = {
                bookId,
                orderId,
                imageNumber: ref.image_number,
                function: `start-generation-${ref.image_number}`
              };

              try {
                log('info', `Starting Leonardo image generation`, {
                  ...logContext,
                  characterId,
                  contentId,
                  styleId,
                  poseId,
                  prompt: formattedPrompt.slice(0, 100) + (formattedPrompt.length > 100 ? '...' : '')
                });

                const genId = await leonardo.generateImage(
                  characterId,
                  contentId,
                  styleId,
                  poseId,
                  formattedPrompt,
                  {
                    characterStrength: "High",
                    contentStrength: "Mid",
                    styleStrength: "Mid",
                    poseWeight: 1.0
                  }
                );

                if (!genId) {
                  throw new Error('Leonardo generateImage returned null/undefined generationId');
                }

                log('info', `Leonardo generation started successfully`, {
                  ...logContext,
                  generationId: genId
                });

                return genId;
              } catch (error) {
                log('error', `Leonardo image generation failed`, {
                  ...logContext,
                  error: error instanceof Error ? error.message : String(error),
                  characterId,
                  contentId,
                  styleId,
                  poseId
                });

                await notifyLeonardoFailure({
                  error: `Leonardo image generation failed for ${ref.image_number}`,
                  failureReason: error instanceof Error ? error.message : String(error),
                  bookId,
                  orderId,
                  imageNumber: ref.image_number,
                  characterId,
                  prompt: formattedPrompt.slice(0, 200) + (formattedPrompt.length > 200 ? '...' : ''),
                  step: `start-generation-${ref.image_number}`,
                  additionalContext: {
                    contentId,
                    styleId,
                    poseId,
                    function: 'generateBookImages'
                  }
                });

                throw error;
              }
            }
          );

          // Wait for image generation to complete
          await step.sleep(`wait-for-generation-${ref.image_number}`, "40s");

          // Save generated image
          await step.run(`save-generation-${ref.image_number}`, async () => {
            const logContext = {
              bookId,
              orderId,
              imageNumber: ref.image_number,
              generationId,
              function: `save-generation-${ref.image_number}`
            };

            try {
              log('info', `Retrieving generated image from Leonardo`, logContext);

              const imageUrl = await leonardo.retrieveGeneratedImage(generationId);
              if (!imageUrl) {
                const errorMsg = `Failed to retrieve image URL for generation after waiting`;
                log('error', errorMsg, logContext);

                await notifyLeonardoFailure({
                  error: `Leonardo image retrieval failed for ${ref.image_number}`,
                  failureReason: `No image URL returned after generation completion wait`,
                  bookId,
                  orderId,
                  imageNumber: ref.image_number,
                  generationId,
                  step: `save-generation-${ref.image_number}`,
                  additionalContext: {
                    function: 'generateBookImages',
                    waitTime: '40s'
                  }
                });

                throw new Error(`Failed to retrieve image URL for ${ref.image_number}`);
              }

              log('info', `Successfully retrieved generated image URL`, {
                ...logContext,
                imageUrl: imageUrl.slice(0, 50) + '...'
              });

              if (!bookData) {
                const errorMsg = `Book data not available when saving`;
                log('error', errorMsg, logContext);
                throw new Error(`Book data not available when saving ${ref.image_number}`);
              }

              const { error: upsertError } = await supabase
                .from("book_photos")
                .upsert({
                  book_id: bookId,
                  order_id: orderId,
                  character_name: bookData.name,
                  character_gender: bookData.gender,
                  reference_image_url: bookData.original_image_url,
                  image_url: imageUrl,
                  image_reference_number: ref.image_number,
                  status: "generated",
                },
                { onConflict: "book_id, image_reference_number" }
              );

              if (upsertError) {
                log('error', `Database upsert error saving generated image`, {
                  ...logContext,
                  upsertError: upsertError.message
                });

                await notifySlack({
                  error: `Database upsert failed for generated image ${ref.image_number}`,
                  failureReason: upsertError.message,
                  additionalContext: {
                    bookId,
                    orderId,
                    imageNumber: ref.image_number,
                    generationId,
                    imageUrl: imageUrl.slice(0, 100) + '...',
                    step: `save-generation-${ref.image_number}`
                  }
                });

                throw upsertError;
              }

              log('info', `Successfully saved generated image to database`, {
                ...logContext,
                imageUrl: imageUrl.slice(0, 50) + '...'
              });
            } catch (error) {
              log('error', `Failed to save generated image`, {
                ...logContext,
                error: error instanceof Error ? error.message : String(error)
              });
              throw error;
            }
          });
        } catch (error) {
          console.error(`❌ Error generating image ${ref.image_number}:`, error);
          throw error;
        }
      }

      // Update final status
      await step.run("verify-and-complete", async () => {
        console.log(`🔍 Verifying all required images are in book_photos table for book ${bookId}, order ${orderId}`);

        const { data: bookPhotos, error: photoError } = await supabase
          .from("book_photos")
          .select("image_reference_number")
          .eq("book_id", bookId)
          .eq("order_id", orderId);

        if (photoError) {
          console.error(`❌ Error verifying book_photos:`, photoError);
          throw photoError;
        }

        const foundImageNumbers = new Set(bookPhotos.map((p: any) => p.image_reference_number));
        const requiredImageCount = 11;
        const missingImages = [];

        for (let i = 1; i <= requiredImageCount; i++) {
          const imageNumber = `image_${i}`;
          if (!foundImageNumbers.has(imageNumber)) {
            missingImages.push(imageNumber);
          }
        }

        if (missingImages.length > 0) {
          console.warn(`⚠️ Missing images in book_photos for book ${bookId}: ${missingImages.join(', ')}. Found ${foundImageNumbers.size}/${requiredImageCount}.`);
        } else {
          console.log(`✅ All ${requiredImageCount} required images are present in book_photos table for book ${bookId}`);
        }

        const { error } = await supabase
          .from("books")
          .update({ status: "completed" })
          .eq("id", bookId);
        if (error) {
          console.error(`❌ Error updating book status to completed:`, error);
          throw error;
        }

        console.log(`✅ Book status updated to completed for book ${bookId}`);
      });

      console.log(`🏁 Function generateBookImages completed successfully for bookId ${bookId}, orderId ${orderId}`);
      await notifyOrderUpdate({ orderId, bookId, message: 'generate-book-images completed successfully' })
      return { success: true, bookId, orderId };

    } catch (error) {
      const logContext = { bookId, orderId, function: 'generateBookImages' };

      log('error', `Book image generation failed`, {
        ...logContext,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      // Send comprehensive Slack notification for function-level failures
      await notifySlack({
        error: `Book image generation function failed`,
        failureReason: error instanceof Error ? error.message : String(error),
        additionalContext: {
          bookId,
          orderId,
          function: 'generateBookImages',
          errorStack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        }
      });

      const { error: updateError } = await supabase
        .from("books")
        .update({ status: "failed" })
        .eq("id", bookId);

      if (updateError) {
        log('error', `Failed to update book status to failed`, {
          ...logContext,
          updateError: updateError.message
        });
      } else {
        log('info', `Book status updated to failed`, logContext);
      }

      throw error;
    }
  }
);