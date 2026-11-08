import { isAllowedAnalyticsEvent, safeAnalyticsProperties } from './analytics-privacy'

let serverPostHog: any = null
if (typeof window === 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY && process.env.NEXT_PUBLIC_POSTHOG_HOST) {
  const { PostHog } = require('posthog-node')
  serverPostHog = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    disableGeoip: true,
    enableExceptionAutocapture: false,
  })
}

export async function trackPostHogEvent(
  event: string,
  properties: Record<string, unknown> = {},
  _userId?: string
) {
  if (!isAllowedAnalyticsEvent(event)) return
  const safeProperties = safeAnalyticsProperties(properties)
  try {
    if (typeof window !== 'undefined') {
      if (!process.env.NEXT_PUBLIC_POSTHOG_KEY || !process.env.NEXT_PUBLIC_POSTHOG_HOST) return
      const { default: client } = await import('posthog-js')
      client.capture(event, safeProperties)
    } else if (serverPostHog) {
      // No customer identity or stable per-book correlation is sent externally.
      serverPostHog.capture({ distinctId: globalThis.crypto.randomUUID(), event, properties: safeProperties })
    }
  } catch {
    console.warn('Analytics delivery failed')
  }
}

export async function trackPhotoUploaded(data: {
  bookId?: string
  filePath: string
  sessionUploadAttempts: number
  remainingUploads: number
  visitorId: string
  hitMaxLimit: boolean
  multipleAttempts: boolean
}) {
  await trackPostHogEvent('Photo Uploaded', {
    book_id: data.bookId,
    session_upload_attempts: data.sessionUploadAttempts,
    remaining_uploads: data.remainingUploads,
    hit_max_limit: data.hitMaxLimit,
    multiple_attempts: data.multipleAttempts
  })
}

export async function trackImageVerification(data: {
  bookId?: string
  filePath: string
  passes: boolean
  failureReason?: string
  appearance?: {
    skinTone?: string
    hair?: string
    eyeColor?: string
  }
}) {
  await trackPostHogEvent(data.passes ? 'Image Verification Passed' : 'Image Verification Failed', {
    book_id: data.bookId,
    passes: data.passes,
  })
}

export async function trackBookPreviewGeneration(data: {
  bookId: string
  name: string
  gender: string
  age: number
  durationMs?: number
  generatedImageUrls?: string[]
  appearance?: {
    skinTone?: string
    hair?: string
    eyeColor?: string
  }
}) {
  await trackPostHogEvent('Book Preview Generated', {
    book_id: data.bookId,
    generation_time_ms: data.durationMs,
    generation_time_seconds: data.durationMs ? Math.round(data.durationMs / 1000) : undefined,
    generated_image_count: data.generatedImageUrls?.length || 0,
  })
}

export async function trackProceedToCheckout(data: {
  bookId: string
  name: string
  gender: string
  age: number
  smsOptIn: boolean
}) {
  await trackPostHogEvent('Proceed to Checkout', {
    book_id: data.bookId,
    sms_opt_in: data.smsOptIn
  })
}

export async function trackCheckoutAndPayment(data: {
  bookId: string
  orderId: string
  customerEmail?: string
  customerName?: string
  amount: number
  currency: string
  shippingAddress?: any
  name?: string
  gender?: string
  age?: number
}) {
  await trackPostHogEvent('Checkout and Payment Completed', {
    book_id: data.bookId,
    order_id: data.orderId,
    amount: data.amount,
    currency: data.currency,
    revenue: data.amount / 100,
    '$revenue': data.amount / 100,
    '$currency': data.currency
  })
}

export async function trackPdfApproval(data: {
  bookId: string
  orderId: string
  status: 'approved' | 'declined'
  declineReason?: string
  customerEmail?: string
  customerName?: string
}) {
  await trackPostHogEvent(data.status === 'approved' ? 'PDF Approved' : 'PDF Declined', {
    book_id: data.bookId,
    order_id: data.orderId,
    status: data.status,
    customer_name: data.customerName
  })
}
