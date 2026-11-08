const events = new Set([
  'Book Created', 'Photo Uploaded', 'Image Verification Passed', 'Image Verification Failed',
  'Book Preview Generated', 'Proceed to Checkout', 'Checkout and Payment Completed',
  'PDF Approved', 'PDF Declined', 'Purchase', '$pageview',
]);
const numeric = new Set(['session_upload_attempts', 'remaining_uploads', 'generation_time_ms', 'generation_time_seconds', 'generated_image_count', 'amount', 'revenue', 'value', '$revenue']);
const boolean = new Set(['hit_max_limit', 'multiple_attempts', 'passes', 'sms_opt_in']);
const staticPaths = new Set(['/', '/create-book', '/preview', '/success', '/approve', '/decline', '/reviews', '/photo-examples', '/book-sample', '/shipping', '/privacy', '/terms', '/refund-policy', '/blog', '/course', '/login']);

export function analyticsPath(pathname: string): string {
  return staticPaths.has(pathname) ? pathname : '/other';
}

// Explicit operational metrics only; unknown strings/IDs and nested input never
// become analytics properties, even if a new caller accidentally supplies them.
export function safeAnalyticsProperties(properties: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(properties).filter(([key, value]) => {
    if (numeric.has(key)) return typeof value === 'number' && Number.isFinite(value) && value >= 0;
    if (boolean.has(key)) return typeof value === 'boolean';
    if (key === 'currency' || key === '$currency') return typeof value === 'string' && /^[A-Z]{3}$/.test(value);
    if (key === 'status') return value === 'approved' || value === 'declined';
    if (key === 'pathname') return typeof value === 'string' && (staticPaths.has(value) || value === '/other');
    return false;
  }));
}

export function isAllowedAnalyticsEvent(event: string): boolean {
  return events.has(event);
}
