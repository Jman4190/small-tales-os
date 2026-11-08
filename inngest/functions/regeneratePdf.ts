import { supabaseSecretKey, supabaseUrl } from '@/lib/supabase-server-env'
// This function is triggered by a 'book/pdf.regenerate.requested' event.
// It regenerates a PDF for the book and uploads it to Supabase, then sends an internal notification.
// inngest/functions/regeneratePdf.ts
import { inngest } from "../client";
import { createClient } from "@supabase/supabase-js";
import crypto from 'crypto';
import { notifyPdfGeneration } from "../../lib/slack"; // Assuming you might still want Slack notifications

// Initialize Supabase client using service role for server-side operations
const supabase = createClient(supabaseUrl, supabaseSecretKey);

export const regeneratePdfTrigger = inngest.createFunction(
  {
    id: "regenerate-pdf", // New ID
    name: "regenerate-pdf",
    priority: {
      run: "150", // Medium-low priority (same as original)
    },
    concurrency: {
      limit: 5, // Same concurrency limit
    }
  },
  { event: "book/pdf.regenerate.requested" }, // Triggered by the new event
  async ({ event, step }) => {
    console.log("Starting PDF regeneration, raw event:");

    const { bookId, orderId } = event.data;
    if (!bookId || !orderId) {
      console.error("Missing required data in event:", event.data);
      throw new Error(`Invalid event data: bookId=${bookId}, orderId=${orderId}`);
    }

    console.log(`Processing PDF regeneration for bookId: ${bookId}, orderId: ${orderId}`);

    // --- Start of PDF generation logic (adapted from generatePdfs.ts) ---

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

    if (!bookData || !bookPhotos) {
        console.error("❌ Missing book data or photos:");
        throw new Error(`Missing book data or photos for bookId: ${bookId}`);
    }

    console.log("✅ Fetched [omitted] book photos and book data:");

    // Find all image records (image_1 through image_11)
    console.log(`🔍 Building image records array for all 11 images`);
    const imageRecords = Array.from({ length: 11 }, (_, i) => {
      const imageNumber = `image_${i + 1}`;
      let record = bookPhotos.find((p: any) => p.image_reference_number === imageNumber);

      if (!record) {
        console.log(`⚠️ Missing record for ${imageNumber} in book_photos table, checking pre-generated images`);

        if ((imageNumber === "image_5" || imageNumber === "image_8") &&
            bookData.generated_image_urls && bookData.generated_image_urls.length > 0) {

          let preGenImageUrl: string | undefined;
          let preGenIndex = -1;

          if (imageNumber === "image_8" && bookData.generated_image_urls.length > 1) {
            preGenImageUrl = bookData.generated_image_urls[1];
            preGenIndex = 1;
            console.log("🧑‍🚒 Checking pre-generated image for [omitted] (firefighter) from generated_image_urls[[omitted]]: [omitted]...");
          } else if (imageNumber === "image_5" && bookData.generated_image_urls.length > 2) {
            preGenImageUrl = bookData.generated_image_urls[2];
            preGenIndex = 2;
            console.log("👨‍🚀 Checking pre-generated image for [omitted] (astronaut) from generated_image_urls[[omitted]]: [omitted]...");
          }

          if (preGenImageUrl) {
              // Check if this image was already inserted into book_photos by generateBookImages
              const existingRecord = bookPhotos.find((p: any) =>
                  p.image_url === preGenImageUrl &&
                  p.image_reference_number === imageNumber
              );

              if (existingRecord) {
                  console.log(`✅ Found existing record for pre-generated ${imageNumber} in book_photos table`);
                  record = existingRecord;
              } else {
                  // If not found, create a virtual record
                  console.log("ℹ️ Creating virtual record for [omitted] from generated_image_urls[[omitted]]");
                  record = {
                      image_reference_number: imageNumber,
                      image_url: preGenImageUrl,
                      character_name: bookPhotos[0]?.character_name || "Unknown", // Use details from other photos
                      character_gender: bookPhotos[0]?.character_gender || "unknown"
                  };
              }
          }
        }

        // If record is still null after checking pre-gen images, throw error
        if (!record) {
            console.error(`❌ Missing ${imageNumber} and no pre-generated image available or found`);
            throw new Error(`Missing ${imageNumber} for the given book`);
        }
      } else {
          console.log(`✅ Found existing record for ${imageNumber} in book_photos table`);
      }
      return record;
    });

    // Final check if any record is missing (should not happen if logic above is correct)
    if (imageRecords.some(r => !r || !r.image_url)) {
        console.error("❌ Failed to build complete image records array");
        throw new Error("Could not construct all image records for PDF generation.");
    }

    console.log("✅ Successfully built all [omitted] image records for PDF generation");

    console.log("📊 Image records summary:");

    const characterName = imageRecords[0].character_name || "Unknown";
    const characterGender = imageRecords[0].character_gender || 'unknown';
    console.log("🧒 Processing PDF for character: [omitted], gender: [omitted]");

    // 2. PDF API call
    const pdfApiToken = process.env.PDF_API_KEY;
    const templateId = process.env.PDF_TEMPLATE_ID;
    if (!pdfApiToken || !templateId) {
      console.error("❌ Missing PDF API credentials");
      throw new Error("Missing PDF API credentials");
    }

    const payload = {
      data: {
        Character_Name: characterName,
        his_her: characterGender === 'boy' ? 'his' : 'her',
        he_she: characterGender === 'boy' ? 'he' : 'she',
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

    console.log("📄 Prepared PDF payload with [omitted] images");

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
      throw new Error(`Failed to call pdf-api.io: ${err.message}`);
    }

    if (!pdfApiResponse.ok) {
      const errText = await pdfApiResponse.text();
      console.error("❌ PDF API error response:");
      throw new Error(`pdf-api.io responded with an error: ${pdfApiResponse.status} ${errText}`);
    }

    console.log(`✅ PDF API response status: ${pdfApiResponse.status}`);
    const pdfResult = await pdfApiResponse.json();
    const pdfGenApiUrl = pdfResult.url; // URL from the API response to download the PDF
    if (!pdfGenApiUrl) {
        console.error("❌ No PDF URL returned by pdf-api.io response");
        throw new Error("No PDF URL returned by pdf-api.io");
    }
    console.log("✅ PDF API generated URL: [omitted]...");


    // 3. Download PDF
    console.log("📥 Downloading PDF from: [omitted]...");
    let pdfDownloadResponse;
    try {
      pdfDownloadResponse = await fetch(pdfGenApiUrl);
    } catch (err: any) {
      console.error("❌ PDF download failed:", err);
      throw new Error(`Failed to download PDF: ${err.message}`);
    }

    if (!pdfDownloadResponse.ok) {
      const errText = await pdfDownloadResponse.text();
      console.error("❌ PDF download error: Status [omitted]");
      throw new Error(`Error downloading PDF (${pdfDownloadResponse.status}): ${errText}`);
    }

    console.log(`✅ PDF download successful: Status ${pdfDownloadResponse.status}`);
    const pdfArrayBuffer = await pdfDownloadResponse.arrayBuffer();
    const pdfBuffer = Buffer.from(pdfArrayBuffer);
    console.log(`📊 PDF size: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    // 4. Upload to Supabase
    const bucketName = "book-photos";
    // Generate a unique filename for the regenerated PDF to avoid overwriting the original
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const pdfFilePath = `pdfs/orders/${orderId}/regenerated-${timestamp}.pdf`;

    console.log("📤 Uploading regenerated PDF to Supabase: [omitted]/[omitted]");
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(pdfFilePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: false // Don't upsert, create a new file each time
      });

    if (uploadError) {
      console.error("❌ Supabase upload error:", uploadError);
      throw new Error(`Failed to upload PDF: ${uploadError.message}`);
    }

    console.log(`✅ Regenerated PDF successfully uploaded to Supabase`);

    // Get the public URL of the uploaded file for updating the orders table
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(pdfFilePath); // pdfFilePath = pdfs/orders/{orderId}/regenerated-{timestamp}.pdf

    // No specific error check needed for getPublicUrl, just proceed if upload worked.
    if (publicUrl) {
      console.log("🔗 Generated public URL for regenerated PDF: [omitted]...");

      // ---> UPDATE ORDERS AND BOOK_APPROVALS TABLES <--- //
      console.log(`📝 Updating orders and book_approvals tables with regenerated PDF URL for orderId: ${orderId} and bookId: ${bookId}`);
      const [orderUpdateResult, approvalUpdateResult] = await Promise.allSettled([
        supabase
          .from("orders")
          .update({ pdf_url: publicUrl }) // Use the public URL here
          .eq("id", orderId),
        supabase
          .from("book_approvals")
          .update({ pdf_url: publicUrl }) // Update book_approvals as well
          .eq("book_id", bookId)
      ]);

      if (orderUpdateResult.status === 'rejected') {
        console.error("❌ Failed to update order with regenerated PDF URL:", orderUpdateResult.reason);
        // Decide if this should be a fatal error. Maybe just log it?
      } else if (orderUpdateResult.value.error) {
          console.error("❌ Failed to update order with regenerated PDF URL:", orderUpdateResult.value.error);
      } else {
        console.log(`✅ Orders table updated successfully with new PDF URL`);
      }

      if (approvalUpdateResult.status === 'rejected') {
          console.error("❌ Failed to update book_approvals with regenerated PDF URL:", approvalUpdateResult.reason);
      } else if (approvalUpdateResult.value.error) {
          console.error("❌ Failed to update book_approvals with regenerated PDF URL:", approvalUpdateResult.value.error);
      } else {
          console.log(`✅ Book_approvals table updated successfully with new PDF URL`);
      }
      // ---> END UPDATE <--- //
    } else {
      console.warn("⚠️ Could not get public URL for regenerated PDF, orders table not updated.");
    }

    // Generate a signed URL for the notification (expires in 7 days)
    const expiresIn = 60 * 60 * 24 * 7; // 7 days in seconds
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(pdfFilePath, expiresIn);

    if (signedUrlError) {
        console.error("❌ Could not get signed URL for uploaded PDF:", signedUrlError);
        throw new Error(`Failed to get signed URL for the regenerated PDF: ${signedUrlError.message}`);
    }

    const signedPdfUrl = signedUrlData?.signedUrl;

    if (!signedPdfUrl) {
        console.error("❌ Could not get signed URL for uploaded PDF:");
        throw new Error("Failed to get signed URL for the regenerated PDF.");
    }
    console.log("🔗 Generated signed URL for regenerated PDF (expires in 7 days): [omitted]...");

    // --- End of PDF generation logic ---

    // DO NOT create a new book_approvals record.
    // DO NOT send the customer preview email.

    // Instead, send an internal notification event
    console.log(`📧 Sending internal notification for regenerated PDF`);
    try {
      await inngest.send({
        name: "internal/pdf.regenerated.notification",
        data: {
          bookId,
          orderId,
          pdfUrl: signedPdfUrl, // Send the SIGNED URL of the newly generated PDF
        },
      });
      console.log(`✅ Internal notification event sent successfully`);
    } catch (error: any) {
      console.error(`⚠️ Failed to trigger internal notification event:`, error);
      // Decide if this should be a fatal error or not. Probably should.
      throw new Error(`Failed to send internal notification event: ${error.message}`);
    }

    // Send Slack notification (optional, can be removed if only email is needed)
    // Consider modifying the message to indicate it's a regeneration
    await notifyPdfGeneration({
      bookId,
      orderId,
      pdfUrl: signedPdfUrl,
      characterName: characterName,
      characterGender: characterGender,
    }).catch(err => console.error('Failed to send regenerated PDF Slack notification:', err));

    console.log(`🎉 PDF regeneration completed successfully for bookId: ${bookId}, orderId: ${orderId}`);

    // Return the essential info (use the public URL as the primary identifier now)
    return { regenerated_pdf_url: publicUrl || signedPdfUrl, bookId, orderId }; // Return publicUrl if available
  }
);