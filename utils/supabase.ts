// /utils/supabase.ts
import { createClient } from '@supabase/supabase-js'
import { supabaseSecretKey, supabaseUrl } from '@/lib/supabase-server-env'

export const supabase = createClient(supabaseUrl, supabaseSecretKey)

// Function to upload file to Supabase Storage
export async function uploadToSupabase(file: File, bucket: string = 'book-photos') {
  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `${fileName}`

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) throw error

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath)

    return { path: data.path, url: publicUrl }
  } catch (error) {
    console.error('Error uploading file:', error)
    throw error
  }
}

export async function getOriginalImageUrl(bookId: string) {
  const { data, error } = await supabase
    .from("books")
    .select("original_image_url, gender")
    .eq("id", bookId)
    .single();

  if (error) {
    throw new Error(`Book not found with ID: ${bookId}`);
  }
  return data;
}

export async function saveGeneratedImage(
  bookId: string,
  orderId: string,
  imageUrl: string,
  imageReferenceNumber: string
) {
  const { data: book } = await supabase
    .from("books")
    .select("name, gender, original_image_url")
    .eq("id", bookId)
    .single();

  if (!book) throw new Error(`Book not found: ${bookId}`);

  const { error } = await supabase.from("book_photos").insert({
    book_id: bookId,
    order_id: orderId,
    character_name: book.name,
    character_gender: book.gender,
    reference_image_url: book.original_image_url,
    image_url: imageUrl,
    image_reference_number: imageReferenceNumber,
    status: "generated",
  });

  if (error) throw error;
}

export async function updateBookStatus(bookId: string, status: 'processing' | 'completed' | 'failed') {
  const { error } = await supabase
    .from("books")
    .update({ status })
    .eq("id", bookId);

  if (error) throw error;
}
