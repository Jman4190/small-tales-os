import { supabaseSecretKey, supabaseUrl } from '@/lib/supabase-server-env'
import { createClient } from '@supabase/supabase-js';
import { Node as Logtail } from '@logtail/js';
import { sanitizeLogDetails } from '@/lib/security';

// Initialize Supabase client
const supabase = createClient(
  supabaseUrl,
  supabaseSecretKey
);

// Initialize BetterStack Logtail client
let logtail: Logtail | null = null;
if (process.env.LOGTAIL_TOKEN && process.env.LOGTAIL_ENDPOINT?.startsWith('https://')) {
  logtail = new Logtail(process.env.LOGTAIL_TOKEN, {
    endpoint: process.env.LOGTAIL_ENDPOINT,
  });
} else {
  console.warn('Logtail token or endpoint not configured. Logging to BetterStack is disabled.');
}

/**
 * Log an event to the book_logs table and BetterStack
 * @param bookId - UUID of the book (optional for some events)
 * @param event - Event name/description
 * @param details - Additional details as JSON object
 * @returns Promise with the result of the insert operation
 */
export async function logBookEvent(
  bookId: string | null,
  event: string,
  details: Record<string, any> = {}
) {
  try {
    const sanitizedDetails = sanitizeLogDetails(details);
    const sanitizedEvent = sanitizeLogDetails(event);

    // Don't block the main execution flow with await
    // This ensures logging doesn't add latency to the API response
    const promise = supabase
      .from('book_logs')
      .insert({
        book_id: bookId,
        event: sanitizedEvent,
        details: sanitizedDetails,
        timestamp: new Date().toISOString(),
      });
    
    // Log to BetterStack in addition to Supabase
    // Using info level by default, can be adjusted based on event type if needed
    if (logtail) {
      logtail.info(sanitizedEvent, {
        book_id: bookId,
        ...sanitizedDetails,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Return the promise without awaiting it
    // The calling code can choose to await or not
    return promise;
  } catch (error) {
    // Log error to console and BetterStack but don't throw to prevent breaking the main flow
    console.error('Error logging book event:', error);
    if (logtail) {
      logtail.error('Error logging book event', sanitizeLogDetails({
        book_id: bookId,
        event: sanitizeLogDetails(event),
        details: sanitizeLogDetails(details),
        error,
      }));
    }
    return null;
  }
}

/**
 * Ensure all logs are sent to BetterStack
 * Call this function before your application terminates
 */
export async function flushLogs() {
  try {
    if (logtail) {
      await logtail.flush();
    }
  } catch (error) {
    console.error('Error flushing logs to BetterStack:', error);
  }
} 
