import { sanitizeLogDetails } from './security';

const LOGTAIL_ENDPOINT = process.env.NEXT_PUBLIC_LOGTAIL_ENDPOINT;
const LOGTAIL_TOKEN = process.env.NEXT_PUBLIC_LOGTAIL_BROWSER_TOKEN;

function sendClientLog(level: 'info' | 'error' | 'warn', message: string, data: Record<string, any>) {
  if (!LOGTAIL_TOKEN || !LOGTAIL_ENDPOINT || !LOGTAIL_ENDPOINT.startsWith('https://') || typeof window === 'undefined') return;

  fetch(LOGTAIL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOGTAIL_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(sanitizeLogDetails({
      ...data,
      level,
      message,
      timestamp: new Date().toISOString(),
    })),
    keepalive: true,
  }).catch((error) => {
    console.error('Error sending client log to BetterStack:', error);
  });
}

/**
 * Log an info event from the client side
 * @param message - Log message
 * @param data - Additional data as JSON object
 */
export function logInfo(message: string, data: Record<string, any> = {}) {
  sendClientLog('info', message, data);
}

/**
 * Log an error event from the client side
 * @param message - Error message
 * @param data - Additional data as JSON object
 */
export function logError(message: string, data: Record<string, any> = {}) {
  sendClientLog('error', message, data);
}

/**
 * Log a warning event from the client side
 * @param message - Warning message
 * @param data - Additional data as JSON object
 */
export function logWarning(message: string, data: Record<string, any> = {}) {
  sendClientLog('warn', message, data);
}

/**
 * Ensure all logs are sent to BetterStack
 * Call this function before your application navigates away or unmounts
 */
export async function flushClientLogs() {
  return Promise.resolve();
}
