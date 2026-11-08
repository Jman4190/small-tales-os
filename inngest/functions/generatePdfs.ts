import { supabaseSecretKey, supabaseUrl } from '@/lib/supabase-server-env'
// This function is triggered by the small-tales-generate-book-images function
// It generates a PDF for the book and uploads it to Supabase
// app/inngest/functions/generatePdfs.ts
import { inngest } from "../client";
import { createClient } from "@supabase/supabase-js";
import crypto from 'crypto';
import { sendPreviewEmail } from "./sendPreviewEmail";
import { notifyPdfGeneration, notifyOrderUpdate } from "../../lib/slack";

// Initialize Supabase client using service role for server-side operations
const supabase = createClient(supabaseUrl, supabaseSecretKey);

export const generatePdfTrigger = inngest.createFunction(
  {
    id: "generate-pdf",
    priority: {
      run: "150", // Medium-low priority (150 seconds)
    },
    concurrency: {
      limit: 5, // Limit to 2 concurrent executions
    }
  },
  {
    event: "inngest/function.finished",
    if: "event.data.function_id == 'small-tales-generate-book-images'"
  },
  async ({ event, step }) => {
    console.log("Starting PDF generation, raw event:");

    // Check if the previous function failed
    if ("error" in event.data) {
      console.error("Previous function error:", event.data.error);
      throw new Error(`Previous function failed: ${event.data.error}`);
    }

    // Extract the result which contains bookId and orderId
    const { result } = event.data;
    if (!result) {
      console.error("No result found in event data:", event.data);
      throw new Error("Missing result in event data");
    }

    // Add type assertion or type guard
    const { bookId, orderId } = result as { bookId: string; orderId: string };
    if (!bookId || !orderId) {
      console.error("Missing required data in result:", result);
      throw new Error(`Invalid result data: bookId=${bookId}, orderId=${orderId}`);
    }

    console.log(`Processing PDF generation for bookId: ${bookId}, orderId: ${orderId}`);
    await notifyOrderUpdate({ orderId, bookId, message: 'generate-pdf started' })

    // 1. Query book_photos and get the cover image
    console.log(`📊 Fetching book photos and cover image for bookId: ${bookId}`);
    const [{ data: bookPhotos, error: photoError }, { data: bookData, error: bookError }] = await Promise.all([
      supabase
        .from("book_photos")
        .select("*")
        .eq("book_id", bookId)
        .order('image_reference_number'),
      supabase
        .from("books")
        .select("generated_image_url, generated_image_urls")
        .eq("id", bookId)
        .single()
    ]);

    if (photoError || bookError) {
      console.error("❌ Error fetching data:", { photoError, bookError });
      throw new Error(`Error fetching data: ${photoError?.message || bookError?.message}`);
    }

    console.log("✅ Fetched [omitted] book photos and book data:");

    // No need to insert cover image into book_photos table

    // Find all image records (image_1 through image_11)
    console.log(`🔍 Building image records array for all 11 images`);
    const imageRecords = Array.from({ length: 11 }, (_, i) => {
      const imageNumber = `image_${i + 1}`;
      const record = bookPhotos.find((p: any) => p.image_reference_number === imageNumber);

      // If we don't have a record for this image, check if it's one of our pre-generated images
      if (!record) {
        console.log(`⚠️ Missing record for ${imageNumber} in book_photos table, checking pre-generated images`);

        // For image_5 (astronaut) and image_8 (firefighter), use pre-generated images if available
        if ((imageNumber === "image_5" || imageNumber === "image_8") &&
            bookData.generated_image_urls && bookData.generated_image_urls.length > 0) {

          // Image_8 is the second pre-generated image (index 1)
          if (imageNumber === "image_8" && bookData.generated_image_urls.length > 1) {
            console.log("🧑‍🚒 Using pre-generated image for [omitted] (firefighter) from generated_image_urls[1]: [omitted]...");

            // Check if this image was already inserted into book_photos by generateBookImages
            const existingRecord = bookPhotos.find((p: any) =>
              p.image_url === bookData.generated_image_urls[1] &&
              p.image_reference_number === imageNumber
            );

            if (existingRecord) {
              console.log(`✅ Found existing record for pre-generated ${imageNumber} in book_photos table`);
              return existingRecord;
            }

            // If not found, create a virtual record
            console.log("ℹ️ Creating virtual record for [omitted] from generated_image_urls[1]");
            return {
              image_reference_number: imageNumber,
              image_url: bookData.generated_image_urls[1],
              character_name: bookPhotos[0]?.character_name || "Unknown",
              character_gender: bookPhotos[0]?.character_gender || "unknown"
            };
          }

          // Image_5 is the third pre-generated image (index 2)
          if (imageNumber === "image_5" && bookData.generated_image_urls.length > 2) {
            console.log("👨‍🚀 Using pre-generated image for [omitted] (astronaut) from generated_image_urls[2]: [omitted]...");

            // Check if this image was already inserted into book_photos by generateBookImages
            const existingRecord = bookPhotos.find((p: any) =>
              p.image_url === bookData.generated_image_urls[2] &&
              p.image_reference_number === imageNumber
            );

            if (existingRecord) {
              console.log(`✅ Found existing record for pre-generated ${imageNumber} in book_photos table`);
              return existingRecord;
            }

            // If not found, create a virtual record
            console.log("ℹ️ Creating virtual record for [omitted] from generated_image_urls[2]");
            return {
              image_reference_number: imageNumber,
              image_url: bookData.generated_image_urls[2],
              character_name: bookPhotos[0]?.character_name || "Unknown",
              character_gender: bookPhotos[0]?.character_gender || "unknown"
            };
          }
        }

        // If we get here, we couldn't find a pre-generated image for this image number
        console.error(`❌ Missing ${imageNumber} and no pre-generated image available`);
        throw new Error(`Missing ${imageNumber} for the given book`);
      }

      console.log(`✅ Found existing record for ${imageNumber} in book_photos table`);
      return record;
    });

    console.log("✅ Successfully built all [omitted] image records for PDF generation");

    // Log a summary of the image records for debugging
    console.log("📊 Image records summary:");

    const characterName = imageRecords[0].character_name || "Unknown";
    console.log("🧒 Processing PDF for character: [omitted], gender: [omitted]");

    // 2. PDF API call
    const pdfApiToken = process.env.PDF_API_KEY;
    const templateId = process.env.PDF_TEMPLATE_ID;
    if (!pdfApiToken || !templateId) {
      console.error("❌ Missing PDF API credentials");
      throw new Error("Missing PDF API credentials");
    }

    // Update payload to include cover_image from books table
    const payload = {
      data: {
        Character_Name: characterName,
        his_her: imageRecords[0].character_gender === 'boy' ? 'his' : 'her',
        he_she: imageRecords[0].character_gender === 'boy' ? 'he' : 'she',
        cover_image: bookData.generated_image_url, // Use cover image from books table
        ...Object.fromEntries(
          imageRecords.map((record, index) => [
            `image_${index + 1}`,
            record.image_url
          ])
        ),
      },
      output: "url",
    };

    console.log(`📄 Prepared PDF payload with ${Object.keys(payload.data).length - 3} images`); // -3 for Character_Name, his_her, he_she

    const pdfApiUrl = `https://pdf-api.io/api/templates/${templateId}/pdf`;
    console.log(`🚀 Calling PDF API at: ${pdfApiUrl}`);

    let pdfApiResponse;
    try {
      pdfApiResponse = await fetch(pdfApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${pdfApiToken}`,
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (err: any) {
      console.error("❌ PDF API call failed:", err);
      throw new Error("Failed to call pdf-api.io");
    }

    if (!pdfApiResponse.ok) {
      const errText = await pdfApiResponse.text();
      console.error("❌ PDF API error response:");
      throw new Error(`pdf-api.io responded with an error: ${errText}`);
    }

    console.log(`✅ PDF API response status: ${pdfApiResponse.status}`);
    const pdfResult = await pdfApiResponse.json();
    console.log("✅ PDF API generated URL: [omitted]...");

    const generatedPdfUrl = pdfResult.url;
    if (!generatedPdfUrl) {
      throw new Error("No PDF URL returned by pdf-api.io");
    }

    // 3. Download PDF
    console.log("📥 Downloading PDF from: [omitted]...");
    let pdfDownloadResponse;
    try {
      pdfDownloadResponse = await fetch(generatedPdfUrl);
    } catch (err: any) {
      console.error("❌ PDF download failed:", err);
      throw new Error("Failed to download PDF");
    }

    if (!pdfDownloadResponse.ok) {
      const errText = await pdfDownloadResponse.text();
      console.error("❌ PDF download error: Status [omitted]");
      throw new Error(`Error downloading PDF: ${errText}`);
    }

    console.log(`✅ PDF download successful: Status ${pdfDownloadResponse.status}`);
    const pdfArrayBuffer = await pdfDownloadResponse.arrayBuffer();
    const pdfBuffer = Buffer.from(pdfArrayBuffer);
    console.log(`📊 PDF size: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    // 4. Upload to Supabase
    const bucketName = "book-photos";
    const pdfFilePath = `pdfs/orders/${orderId}/generated.pdf`;

    console.log("📤 Uploading PDF to Supabase: [omitted]/[omitted]");
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(pdfFilePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true
      });

    if (uploadError) {
      console.error("❌ Supabase upload error:", uploadError);
      throw new Error(`Failed to upload PDF: ${uploadError.message}`);
    }

    console.log(`✅ PDF successfully uploaded to Supabase`);

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(pdfFilePath);

    console.log("🔗 Generated public URL: [omitted]...");

    // Update orders table
    console.log(`📝 Updating orders table with PDF URL for orderId: ${orderId}`);
    const { error: updateError } = await supabase
      .from("orders")
      .update({ pdf_url: publicUrl })
      .eq("id", orderId);

    if (updateError) {
      console.error("❌ Failed to update order:", updateError);
      throw new Error(`Failed to update order: ${updateError.message}`);
    }

    console.log(`✅ Orders table updated successfully`);

    // Generate a random token for approval link
    const token = crypto.randomBytes(32).toString('hex');
    console.log("🔑 Generated approval token: [omitted]...");

    // Insert into book_approvals
    console.log("📝 Creating book approval record with token for bookId: [omitted]");
    const { error: approvalError } = await supabase
      .from("book_approvals")
      .insert({
        book_id: bookId,
        order_id: orderId,
        status: 'pending',
        token: token,
        // Don't need to set pdf_url or user_email - trigger handles these
      });

    if (approvalError) {
      console.error(`❌ Failed to create approval record:`, approvalError);
      throw new Error(`Failed to create approval record: ${approvalError.message}`);
    }

    console.log(`✅ Book approval record created successfully`);

    // Before sending email
    console.log("📧 Preparing to send preview email with token: [omitted]...");

    try {
      // Get user email from orders table
      console.log(`🔍 Fetching customer email for orderId: ${orderId}`);
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("customer_email")
        .eq("id", orderId)
        .single();

      if (orderError || !orderData) {
        console.error(`❌ Failed to fetch order data:`, orderError);
        throw new Error(`Failed to fetch order data: ${orderError?.message}`);
      }

      console.log(`📧 Sending preview email to: ${orderData.customer_email}`);

      // Update the event name to match your defined event types
      await inngest.send({
        name: "book/preview.email.requested",
        data: {
          userEmail: orderData.customer_email,
          token,
          orderId,
          bookId,
        },
      });

      console.log(`✅ Preview email request sent successfully`);
    } catch (error: any) {
      console.error(`⚠️ Failed to trigger preview email:`, error);
      // Continue execution - don't throw error
    }

    console.log(`🎉 PDF generation completed successfully for bookId: ${bookId}, orderId: ${orderId}`);

    // Send Slack notification
    await notifyPdfGeneration({
      bookId,
      orderId,
      pdfUrl: publicUrl,
      characterName: characterName,
      characterGender: imageRecords[0].character_gender
    }).catch(err => console.error('Failed to send PDF generation notification:', err));

    await notifyOrderUpdate({ orderId, bookId, message: 'generate-pdf succeeded' })
    return { pdf_url: publicUrl, bookId, orderId };
  }
);