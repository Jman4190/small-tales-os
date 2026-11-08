// Re-export server-side logging functions
export { logBookEvent, flushLogs } from './book-logger';

// Re-export client-side logging functions
export { logInfo, logError, logWarning, flushClientLogs } from './client-logger';

/**
 * Utility function to determine if code is running on client or server
 * @returns boolean - true if running in browser
 */
export const isClient = typeof window !== 'undefined';

/**
 * Universal log function that works in both client and server environments
 * @param level - Log level: 'info', 'error', or 'warn'
 * @param message - Log message
 * @param data - Additional data
 */
export function log(
  level: 'info' | 'error' | 'warn',
  message: string,
  data: Record<string, any> = {}
) {
  if (isClient) {
    // Import dynamically to avoid server-side import issues
    import('./client-logger').then((clientLogger) => {
      if (level === 'info') clientLogger.logInfo(message, data);
      else if (level === 'error') clientLogger.logError(message, data);
      else if (level === 'warn') clientLogger.logWarning(message, data);
    });
  } else {
    // For server-side, we'll use console logging and book event logging if applicable
    if (level === 'info') console.info(message, data);
    else if (level === 'error') console.error(message, data);
    else if (level === 'warn') console.warn(message, data);
    
    // If there's a bookId in the data, also log to book events
    if (data.bookId) {
      import('./book-logger').then((bookLogger) => {
        bookLogger.logBookEvent(data.bookId, message, data);
      });
    }
  }
} 