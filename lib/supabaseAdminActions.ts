'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminUser } from '@/lib/admin-auth';
import { logBookEvent } from '@/lib/logger'; // Import the actual logger
// import { inngest } from '@/utils/inngest'; // Placeholder for Inngest client

// Define expected types for better clarity
// Exporting this type to be used across components
export type BookPhoto = {
  id: string; // Corrected: PK is uuid -> string
  book_id: string;
  order_id: string;
  image_url: string;
  image_reference_number: string | null; // Corrected: Column name and type (text)
  created_at: string;
  updated_at: string | null;
  // Add other fields from book_photos table as needed
  character_name?: string | null; // Added from schema
  status?: string;              // Added from schema
  character_gender?: string | null; // Added from schema
  reference_image_url?: string | null; // Added from schema
};

type OrderWithBook = {
  id: string; // Correct: PK column in orders table is 'id'
  books: {
    id: string;
    name: string | null;
  } | null;
};

type BookWithOrder = {
  order_id: string | null;
};

type OrderWithPdfUrl = {
  admin_pdf_url: string | null;
};

// Helper to check authentication and admin role
async function checkAdminAuth() {
  const admin = await requireAdminUser();
  if (!admin.ok) throw new Error(admin.error);
  return admin;
}

// Fetch function for the main admin page book selector
export async function getBooksForAdminSelection(): Promise<{ order_id: string; book_id: string; title: string }[]> {
  const { supabase } = await checkAdminAuth();

  // Fetch orders and related book title/id
  const { data, error } = await supabase
    .from('orders')
    .select(
      `
      id, 
      books (
        id,
        name
      )
    `
    )
    .eq('payment_status', 'paid')
    .not('book_id', 'is', null)
    .order('created_at', { ascending: false })
    .returns<OrderWithBook[]>(); // Type for the raw query result

  if (error) {
    console.error(
      'Error fetching books for admin selection:',
      `Message: ${error.message}, Code: ${error.code}`,
      error
    );
    return [];
  }

  // Flatten the data structure for the selector component
  const formattedData = (data ?? [])
    .map((order: OrderWithBook) => {
      const book = order.books;
      if (!book) return null;
      return {
        order_id: order.id, // Map orders.id to order_id
        book_id: book.id,
        title: book.name ?? 'Untitled Book',
      };
    })
    .filter(Boolean) as { // Assert non-null type after filtering
    order_id: string;
    book_id: string;
    title: string;
  }[];

  return formattedData;
}

// Fetch photos for a specific book
export async function getBookPhotos(bookId: string): Promise<BookPhoto[]> {
  if (!bookId) {
    console.error('getBookPhotos called without bookId');
    return [];
  }
  const { supabase } = await checkAdminAuth();

  // First, try fetching by book_id directly
  let photos: BookPhoto[] | null = null;
  const { data: photosByBookId, error: bookIdError } = await supabase
    .from('book_photos')
    .select('*')
    .eq('book_id', bookId)
    .order('image_reference_number', { ascending: true }) // Corrected column name
    .returns<BookPhoto[]>();

  if (bookIdError) {
    console.error(`Error fetching photos for book ${bookId} by book_id:`, bookIdError);
    // Don't return yet, try fallback
  } else {
    photos = photosByBookId;
  }

  // If no photos found by book_id, try finding the order_id and searching by that
  if (!photos || photos.length === 0) {
    console.log(`No photos found for book_id ${bookId}, trying order_id fallback...`);
    // Corrected: Query 'orders' table, filter by book_id and payment_status
    const { data: orderData, error: orderFetchError } = await supabase
      .from('orders')
      .select('id') // Select the order's ID
      .eq('book_id', bookId) // Filter by the book ID
      .eq('payment_status', 'paid') // Filter for the paid order
      .maybeSingle<{ id: string }>(); // Expecting zero or one paid order for this book

    if (orderFetchError) {
      console.error(
        `Error finding paid order_id for book ${bookId}:`,
        orderFetchError
      );
      return []; // Can't proceed with fallback
    }
    if (!orderData?.id) {
       console.error(
        `Could not find a paid order associated with book ${bookId}.`
      );
      return []; // No paid order_id found
    }

    const orderId = orderData.id; // Use the found order ID
    console.log(`Found paid order_id ${orderId}, fetching photos by order_id...`);
    const { data: photosByOrder, error: orderError } = await supabase
      .from('book_photos')
      .select('*')
      .eq('order_id', orderId)
      .order('image_reference_number', { ascending: true }) // Corrected column name
      .returns<BookPhoto[]>();

    if (orderError) {
      console.error(`Error fetching photos for order ${orderId}:`, orderError);
      return []; // Return empty if fallback also fails
    }
    photos = photosByOrder;
  }

  // Ensure photos is always an array
  return photos ?? [];
}

// Update image URL
export async function updateImageUrl(
  photoId: string, // Ensure this is typed as string for the UUID
  newUrl: string,
  originalUrl: string,
  bookId: string,
  orderId: string // We will now use this in the update query
): Promise<{ success: boolean; updatedId?: string; error?: string }> { 
  if (!photoId || !newUrl || !bookId || !orderId) {
     console.error('Missing required parameters for updating image URL.');
     return { success: false, error: 'Missing required parameters.' };
  }
  const { supabase, user } = await checkAdminAuth();

  console.log(`Attempting to update photo ID: ${photoId} for order ID: ${orderId}`); // Add log

  const { data, error } = await supabase
    .from('book_photos')
    .update({ image_url: newUrl }) 
    .eq('id', photoId) // Match using the unique UUID 'id'
    .eq('order_id', orderId) // <<< Also match the order_id
    .select('id'); // Select the id to confirm which row was updated

  if (error) {
    console.error(`Supabase error updating image URL for photo ${photoId} (order ${orderId}):`, error);
    // Return a structured error
    return { success: false, error: `Database error: ${error.message}` };
  }

  // Check if the update actually affected any rows
  if (!data || data.length === 0) {
    // Add more context to the warning
    console.warn(`Update attempt for photo ID ${photoId} (order ${orderId}) affected 0 rows. Check if ID and Order ID combination exists and RLS allows it.`);
    return { success: false, error: `Photo with ID ${photoId} associated with Order ID ${orderId} not found or update denied.` };
  }

  // Since we matched by unique ID, we expect exactly one result.
  // If data.length > 1, something is fundamentally wrong with the PK constraint or the query.
  if (data.length > 1) {
     console.error(`Critical Error: Multiple photos updated with unique ID ${photoId}. This should not happen.`);
     // Still technically a success? Or treat as error?
     // Let's treat as an error for safety.
     return { success: false, error: 'Critical: Multiple rows matched unique ID.' };
  }

  // Get the ID from the single returned row
  const updatedId = data[0].id;

  // Log the event after successful update
  try {
      await logBookEvent(bookId, 'updated_image_url', {
        photo_id: updatedId,
        order_id: orderId,
        previous_url: originalUrl,
        new_url: newUrl,
        updated_by: user.id,
      });
  } catch (logError) {
      console.error('Failed to log image update event:', logError);
      // Don't block the main success response, but log the error
  }

  // Revalidate the cache
  revalidatePath(`/admin/books/${bookId}`);

  console.log(`Successfully updated image URL for photo ${updatedId}`);
  return { success: true, updatedId: updatedId };
}

// Trigger PDF regeneration (via Inngest)
export async function triggerPdfRegeneration(bookId: string): Promise<{ success: true; orderId: string }> {
  if (!bookId) {
    throw new Error('Book ID is required to trigger PDF regeneration.');
  }
  const { supabase, user } = await checkAdminAuth(); // Include user if needed for logging/audit

  // 1. Find the order_id associated with the book_id
  const { data: bookData, error: bookError } = await supabase
    .from('books')
    .select('order_id')
    .eq('book_id', bookId)
    .maybeSingle<BookWithOrder>(); // Use maybeSingle

  if (bookError) {
    console.error(
      `Error finding order_id for book ${bookId}:`,
      bookError
    );
    throw new Error(`Database error finding order for book ${bookId}: ${bookError.message}`);
  }
  if (!bookData?.order_id) {
    console.error(`Could not find an order associated with book ${bookId}.`);
    throw new Error('Could not find associated order for the book.');
  }
  const orderId = bookData.order_id;

  // 2. Send event to Inngest (or your background job system)
  try {
    // Placeholder for Inngest call
    console.log(
      `User ${user.id} triggering PDF regeneration via Inngest: admin/pdf.regenerate for order ${orderId} (book ${bookId})`
    );
    // await inngest.send({
    //   name: 'admin/pdf.regenerate',
    //   data: {
    //     orderId: orderId,
    //     bookId: bookId,
    //     triggeredBy: user.id, // Pass user ID
    //   },
    // });

    // --- Mock Inngest Call Placeholder ---
    // setTimeout(async () => { ... }, 10000);
    // --- End Mock ---

    // Log the trigger event - Corrected call
    await logBookEvent(bookId, 'admin.pdf.regenerate.trigger', {
      order_id: orderId,
      triggered_by: user.id
    });

    return { success: true, orderId: orderId };
  } catch (e: unknown) {
    console.error('Error sending PDF regeneration event:', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    throw new Error(`Failed to trigger PDF regeneration: ${errorMessage}`);
  }
}

// Poll for the updated PDF URL generated by an admin trigger
export async function getUpdatedPdfUrl(orderId: string): Promise<{ pdfUrl: string | null; found: boolean }> {
  if (!orderId) {
    throw new Error('Order ID is required to check for updated PDF URL.');
  }
  const { supabase } = await checkAdminAuth();

  const { data, error } = await supabase
    .from('orders')
    .select('admin_pdf_url')
    .eq('order_id', orderId)
    .maybeSingle<OrderWithPdfUrl>(); // Use maybeSingle to handle not found gracefully

  if (error) {
    // maybeSingle returns null for data and no error if not found.
    // An error here indicates a real database issue.
    console.error(
      `Error fetching admin_pdf_url for order ${orderId}:`,
      error
    );
    // Depending on polling strategy, might want to throw or return specific error state
    // For now, treat DB errors as 'not found' for simplicity in polling logic.
     return { pdfUrl: null, found: false };
     // Or throw new Error(`Database error fetching PDF URL: ${error.message}`);
  }

  if (!data) {
     // Order legitimately not found or doesn't have the column selected (unlikely with select)
     console.warn(`Order ${orderId} not found when polling for PDF or admin_pdf_url missing.`);
     return { pdfUrl: null, found: false };
  }

  // Return the URL if it exists (is not null), otherwise null
  return { pdfUrl: data.admin_pdf_url ?? null, found: true };
}
