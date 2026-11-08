import { notFound } from 'next/navigation';
import { requireAdminUser } from '@/lib/admin-auth';
import type { SupabaseClient } from '@supabase/supabase-js'; // Import type from the core package
// Import the shared BookPhoto type and server actions
import { getBookPhotos, updateImageUrl, type BookPhoto } from '@/lib/supabaseAdminActions';
import BookPhotoTable from '@/components/admin/BookPhotoTable'; // Import the new table component
import RegeneratePdfButton from '@/components/admin/RegeneratePdfButton'; // Import the new button
import Link from 'next/link';
import ViewPdfButton from '@/components/admin/ViewPdfButton'; // Import the new View PDF button
import ResendApprovalButton from '@/components/admin/ResendApprovalButton'; // <-- Import the new button
import AdminApproveButton from '@/components/admin/AdminApproveButton'; // <-- Import the admin approve button
import AdminWorkflow from '@/components/admin/AdminWorkflow'; // <-- Import the new workflow component
import type { Metadata, ResolvingMetadata } from 'next'; // Import Metadata types

// Define the expected type for photo data -> REMOVED, importing instead
// Mirrors the structure expected from getBookPhotos
/* // REMOVED type definition
type BookPhoto = {
  id: string; // Corrected: PK is uuid -> string
  book_id: string;
  order_id: string;
  image_url: string;
  image_reference_number: string | null; // Corrected: Column name and type (text)
  created_at: string;
  updated_at: string | null;
  // Add other potentially relevant fields from the updated type
  character_name?: string | null;
  status?: string;
  character_gender?: string | null;
  reference_image_url?: string | null;
};
*/

// Interface for the book details we need for prompts
interface BookPromptDetails {
  age: number | null;
  gender: string | null;
  name: string | null;
  appearance: {
    skinTone?: string | null;
    hair?: string | null;
    eyeColor?: string | null;
  } | null;
}

// Interface for the book approval details
interface BookApprovalDetails {
  status: string | null;
  decline_reason: string | null;
}

// Helper function within the page to get the order ID and PDF URL for a book
// Creates its own client now
async function getOrderIdAndPdfUrlForBook(supabase: SupabaseClient, bookId: string): Promise<{ orderId: string | null; pdfUrl: string | null }> {
  const { data, error } = await supabase
    .from('orders') // Query the 'orders' table
    .select('id, pdf_url') // Select order ID (assuming it's 'id') and pdf_url
    .eq('book_id', bookId) // Filter by book_id
    .eq('payment_status', 'paid') // <<< ADDED: Filter for paid orders only
    .maybeSingle(); // Use maybeSingle as a book might not have an order yet

  if (error) {
    // Check specifically for the multiple rows error
    if (error.code === 'PGRST116') {
        console.error(`CRITICAL DATA ISSUE: Multiple PAID orders found for book_id ${bookId}. Only one expected.`);
        // Decide how to handle: return the first? return error? For now, returning null like other errors.
    } else {
        console.error(`Error fetching order details for book ${bookId}:`, error);
    }
    return { orderId: null, pdfUrl: null }; // Return nulls if error or multiple paid orders found
  }

  // Assuming the primary key of orders is 'id' which corresponds to the order_id needed elsewhere
  return { orderId: data?.id ?? null, pdfUrl: data?.pdf_url ?? null };
}

// Helper function to get book details for prompt generation
async function getBookPromptDetails(supabase: SupabaseClient, bookId: string): Promise<BookPromptDetails | null> {
  const { data, error } = await supabase
    .from('books')
    .select('age, gender, name, appearance')
    .eq('id', bookId)
    .single();

  if (error) {
    console.error(`Error fetching book prompt details for book ${bookId}:`, error);
    return null;
  }
  // Ensure appearance is structured correctly, handling null
  const appearanceData = data?.appearance as any; // Cast for easier access
  const appearance = appearanceData ? {
      skinTone: appearanceData.skinTone ?? null,
      hair: appearanceData.hair ?? null,
      eyeColor: appearanceData.eyeColor ?? null,
    } : null;

  return {
    age: data.age ?? null,
    gender: data.gender ?? null,
    name: data.name ?? null, // Added name fetch
    appearance: appearance
  };
}

// Helper function to get book approval details
async function getBookApprovalDetails(supabase: SupabaseClient, bookId: string): Promise<BookApprovalDetails | null> {
  console.log(`[getBookApprovalDetails] Fetching for bookId: ${bookId}`); // Log input bookId
  const { data, error } = await supabase
    .from('book_approvals')
    .select('status, decline_reason') // Corrected column name
    .eq('book_id', bookId)
    .maybeSingle(); // Use maybeSingle as a book might not have approval info yet

  // Log raw Supabase response
  console.log(`[getBookApprovalDetails] Supabase response for ${bookId}:`, { data: data, error: error ? JSON.stringify(error, null, 2) : null });

  if (error) {
    // Improved logging: Stringify to catch potential non-standard error shapes
    console.error(`[getBookApprovalDetails] Error fetching book approval details for book ${bookId}:`, JSON.stringify(error, null, 2));
    // Also log the error message if it exists
    if (error.message) {
        console.error(`[getBookApprovalDetails] Supabase Error Message: ${error.message}`);
    }
    // Consider adding error.code or error.details if available
    console.log(`[getBookApprovalDetails] Returning null due to error for bookId: ${bookId}`);
    return null;
  }

  // If data exists but status is null, default it (though query returns null from DB if column is null)
  const approvalStatus = data?.status ?? null;
  const declineReason = data?.decline_reason ?? null;

  // Determine the result object
  const result = data ? {
    status: approvalStatus,
    decline_reason: declineReason
  } : { status: null, decline_reason: null }; // Return nulls if no data found (data is null)

  // Log the final returned object
  console.log(`[getBookApprovalDetails] Returning result for bookId ${bookId}:`, result);

  return result;
}

// Use inline type for the Page component props
export default async function BookDetailsPage({ 
  params, // Keep simple here
} : {
  // Declare params as a Promise matching generated PageProps
  params: Promise<{ bookId: string }>; 
}) {
  // Await the promise to get the actual params object
  const actualParams = await params; 
  // Destructure from the resolved object
  const { bookId } = actualParams;

  if (!bookId) {
    notFound(); // If bookId is missing in params, show 404
  }

  // Pages and their data reads must be protected independently of middleware.
  const admin = await requireAdminUser();
  if (!admin.ok) notFound();
  const { supabase } = admin;

  // Fetch book photos, order details, and prompt details in parallel
  let bookPhotos: BookPhoto[] = [];
  let orderDetails: { orderId: string | null; pdfUrl: string | null } = { orderId: null, pdfUrl: null };
  let bookPromptDetails: BookPromptDetails | null = null; // Add state for book details
  let fetchError = false;
  let bookApprovalDetails: BookApprovalDetails | null = null; // Add state for approval details

  try {
    // Fetch all data concurrently
    [bookPhotos, orderDetails, bookPromptDetails, bookApprovalDetails] = await Promise.all([
      getBookPhotos(bookId),
      getOrderIdAndPdfUrlForBook(supabase, bookId),
      getBookPromptDetails(supabase, bookId), // Fetch prompt details
      getBookApprovalDetails(supabase, bookId) // Fetch approval details
    ]);

    const { orderId } = orderDetails;

    if (orderId === null) {
      console.warn(`Could not find order ID for book ${bookId}. The book might not exist or data is inconsistent.`);
    }
    if (bookPromptDetails === null) {
        console.warn(`Could not find prompt details for book ${bookId}. Prompts may not display correctly.`);
        // Decide if this is critical. For now, we'll allow rendering but prompts will be basic.
    }

  } catch (error: any) {
    console.error(`Failed to fetch details for book ${bookId}:`, error);
    fetchError = true;
  }

  // Use fetched name if available, otherwise fallback
  const characterName = bookPromptDetails?.name || bookPhotos[0]?.character_name || 'Unknown Character';
  const pageTitle = `Manage ${characterName}'s Book`;
  const { orderId, pdfUrl } = orderDetails;
  const { status: approval_status, decline_reason } = bookApprovalDetails || { status: null, decline_reason: null };

  // If fetch failed critically, maybe show an error page
  if (fetchError && !orderId) {
    // Simple error display, can be enhanced
    return (
      <div className="container mx-auto p-4 text-red-600">
        <p>Error loading book details. Please try again later or select a different book.</p>
        <Link href="/admin" className="text-blue-500 hover:underline">Back to Admin Dashboard</Link>
      </div>
    );
  }
  // Basic check if photos were found - could enhance ImageList to show a message too
  // if (bookPhotos.length === 0 && !fetchError) {
  //   console.log(`No photos found for book ${bookId}.`);
  //   // Decide how to render - maybe show the actions wrapper but an empty image list
  // }

  return (
    <div className="container mx-auto p-4">
      <Link href="/admin" className="text-sm text-blue-600 hover:underline mb-4 block"> &larr; Back to Book Selection</Link>

      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h1 className="text-xl font-semibold mb-2">{pageTitle}</h1>
        <p className="text-sm text-gray-500 mb-1">Book ID: {bookId}</p>
        {orderId ? (
            <p className="text-sm text-gray-600 mb-1">Order ID: {orderId}</p>
        ) : (
            <p className="text-sm text-orange-600 mb-1">Order ID not found.</p>
        )}
        {/* Display Approval Status */}
        {approval_status ? (
          <p className={`text-sm mb-1 ${approval_status === 'declined' ? 'text-red-600' : 'text-green-600'}`}>
            Status: {approval_status}
          </p>
        ) : (
          <p className="text-sm text-gray-500 mb-1">Status: Not yet reviewed</p>
        )}
        {/* Display Decline Reason if applicable */}
        {approval_status === 'declined' && decline_reason && (
          <p className="text-sm text-red-700 bg-red-100 p-2 rounded mb-3">
            Decline Reason: {decline_reason}
          </p>
        )}
        <ViewPdfButton orderId={orderId} initialPdfUrl={pdfUrl} />
      </div>

      {!orderId && !fetchError && <p className="text-sm text-orange-600 mb-4">Warning: Could not determine associated Order ID. Cannot edit images.</p>}

      {orderId && bookPromptDetails ? (
         <BookPhotoTable
            bookId={bookId}
            orderId={orderId}
            photos={bookPhotos}
            updateImageUrlAction={updateImageUrl}
            age={bookPromptDetails.age}
            gender={bookPromptDetails.gender}
            appearance={bookPromptDetails.appearance}
          />
      ) : (
         <p className="text-gray-500 mt-6">{!orderId ? 'Cannot manage images without a valid Order ID.' : 'Cannot display images table due to missing book details.'}</p>
      )}
      {fetchError && <p className="text-red-500 mt-4">There was an error loading some book details.</p>}

      {/* Admin Workflow Section - Moved below images */}
      <div className="mt-8">
        <AdminWorkflow bookId={bookId} orderId={orderId} />
      </div>
    </div>
  );
}

// Define a specific type for generateMetadata props
interface GenerateMetadataProps {
  // Declare params as a Promise matching generated PageProps
  params: Promise<{ bookId: string }>;
  // searchParams?: { [key: string]: string | string[] | undefined }; // Add if you use searchParams
}

export async function generateMetadata(
  { params }: GenerateMetadataProps, // Keep simple here
  parent: ResolvingMetadata // Keep parent if you need to resolve previous metadata
): Promise<Metadata> { // Explicitly return Promise<Metadata>
  const admin = await requireAdminUser();
  if (!admin.ok) notFound();
  // const parentMetadata = await parent // Example: accessing parent metadata
  
  // Await the promise to get the actual params object
  const actualParams = await params; // ✅ also required here
  // Destructure from the resolved object
  const { bookId } = actualParams;

  return {
    title: `Admin - Manage Book ${bookId}`,
    // other metadata fields
  };
}
