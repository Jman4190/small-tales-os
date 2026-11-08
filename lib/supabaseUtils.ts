import { supabase } from '@/utils/supabase'; // <-- Import the service role client
import { StorageError } from '@supabase/storage-js'; // Import StorageError type
import { supabaseUrl } from '@/lib/supabase-server-env';

// Helper function for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Creates a signed URL for a file in a specified bucket using the global service role client.
 * Handles extracting relative path from full URL if necessary.
 * Includes retry logic for "Object not found" errors.
 * 
 * @param bucketName - The name of the Supabase Storage bucket.
 * @param filePath - The full path or relative path within the bucket.
 * @param expiresInSeconds - How long the URL should be valid for (default 1 hour, max 7 days).
 * @param maxRetries - Maximum number of retry attempts for "Object not found".
 * @param retryDelayMs - Delay between retries in milliseconds.
 * @returns The signed URL string.
 * @throws If Supabase fails to generate the URL after retries.
 */
export async function createExpiringSignedUrl(
  bucketName: string,
  filePath: string,
  expiresInSeconds: number = 3600, // Default 1 hour
  maxRetries: number = 3,
  retryDelayMs: number = 1000
): Promise<string> {
  const validExpiresIn = Math.max(60, Math.min(604800, expiresInSeconds));

  // --- Start Path Processing ---
  let pathWithinBucket = filePath; // Start assuming filePath is already relative within the bucket

  // Check if filePath looks like a full URL and try to extract the path after the bucket name
  const storagePathSegment = `/storage/v1/object/public/${bucketName}/`; // Path segment in Supabase URLs
  if (filePath.includes(storagePathSegment)) {
      try {
        // Extract the part after the known storage path segment
        pathWithinBucket = filePath.split(storagePathSegment)[1];
      } catch (e) {
        console.warn("Could not reliably extract path from full URL using split: [omitted]. Falling back.");
        // Fallback might be needed if URL structure varies unexpectedly
      }
  } else if (filePath.startsWith(supabaseUrl)) {
      // Handle URLs that might not contain the full public path segment (e.g., other URL formats)
      try {
          const url = new URL(filePath);
          const pathSegments = url.pathname.split('/').filter(Boolean); // Split and remove empty segments
          const bucketIndex = pathSegments.findIndex(segment => segment === bucketName);
          if (bucketIndex !== -1 && bucketIndex < pathSegments.length - 1) {
              pathWithinBucket = pathSegments.slice(bucketIndex + 1).join('/');
          } else {
              console.warn("Bucket name '[omitted]' not found or is the last segment in URL path: [omitted]. Using original path.");
          }
      } catch (e) {
          console.warn("Error parsing filePath as URL: [omitted]. Proceeding with potentially relative path.");
      }
  }

  // After handling URLs, check if the result *still* starts with the bucket name
  // This handles cases where filePath was like "bucketName/actual/path.ext"
  const bucketPrefix = `${bucketName}/`;
  if (pathWithinBucket.startsWith(bucketPrefix)) {
      pathWithinBucket = pathWithinBucket.substring(bucketPrefix.length);
  }

  // Ensure no leading slash, as Supabase paths are relative to the bucket root
  if (pathWithinBucket.startsWith('/')) {
      pathWithinBucket = pathWithinBucket.substring(1);
  }
  // --- End Path Processing ---

  console.log("Attempting to create signed URL for processed path: \"[omitted]\", bucket: [omitted], expiration: [omitted]s using global service client");

  // --- Start Debug Existence Check ---
  try {
    const { data: list, error: listErr } = await supabase
      .storage
      .from(bucketName)
      .list(
        pathWithinBucket.includes('/') ? pathWithinBucket.substring(0, pathWithinBucket.lastIndexOf('/')) : '', // List in the correct directory if path has folders
        { search: pathWithinBucket.substring(pathWithinBucket.lastIndexOf('/') + 1), limit: 1 } // Search for the filename
      );

    if (listErr) {
      console.error('Debug Check: Error listing files:', listErr);
    } else {
      console.log('Debug Check: Supabase sees the file?', list);
      if (list && list.length === 0) {
         console.warn("Debug Check: File \"[omitted]\" NOT FOUND in bucket \"[omitted]\" via list().");
      } else if (list) {
         console.log("Debug Check: File \"[omitted]\" FOUND in bucket \"[omitted]\" via list(). Name: [omitted]");
      }
    }
  } catch (e) {
      console.error('Debug Check: Error during list check:', e);
  }
  // --- End Debug Existence Check ---

  let lastError: Error | StorageError | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(pathWithinBucket, validExpiresIn); // Use the processed path

    if (!error && data?.signedUrl) {
      console.log("Signed URL created successfully for \"[omitted]\" on attempt [omitted]");
      return data.signedUrl;
    }

    lastError = error || new Error('No signed URL generated by Supabase (data was null)');
    console.error(`createExpiringSignedUrl attempt ${attempt} failed:`, lastError);

    // Check if it's the specific "Object not found" error and if we should retry
    // Supabase StorageApiError often has a specific message or status code (like 400 or 404 for not found)
    const isNotFoundError = lastError instanceof Error && lastError.message.includes('Object not found');
    // Alternatively, check status if available: const isNotFoundError = (error as any)?.status === 400 || (error as any)?.status === 404;


    if (isNotFoundError && attempt < maxRetries) {
      console.log(`Object not found, retrying in ${retryDelayMs}ms... (${attempt}/${maxRetries})`);
      await delay(retryDelayMs);
    } else {
      // Don't retry for other errors or if max retries reached
      console.error('Not retrying or max retries reached.');
      break; 
    }
  }

  // If loop finishes without returning, throw the last error
  console.error("Failed to create signed URL for original path \"[omitted]\" (processed as \"[omitted]\") after [omitted] attempts.");
  throw lastError ?? new Error(`Failed to create signed URL for ${filePath} after ${maxRetries} attempts.`);
} 
