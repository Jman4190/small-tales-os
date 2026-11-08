import { supabaseSecretKey, supabaseUrl } from '@/lib/supabase-server-env'
import { createClient } from '@supabase/supabase-js'
import { redactToken } from '@/lib/security'
import { refreshPdfUrl } from '@/lib/refresh-pdf-url'

const supabase = createClient(
  supabaseUrl,
  supabaseSecretKey
)

interface SlackNotificationData {
  error: string
  failureReason?: string
  filePath?: string
  additionalContext?: Record<string, any>
}

interface BookCheckoutData {
  bookId: string
  sessionId: string
  amount: number
  currency: string
  name?: string
  gender?: string
  age?: number
  appearance?: {
    skinTone: string
    hair: string
  }
}

interface GeneratedImageData {
  bookId: string
  name: string
  gender: string
  age: number
  generatedImageUrl: string
  generatedImageUrls?: string[]
  appearance: {
    skinTone: string
    hair: string
  }
  durationMs?: number
}

interface PdfGenerationData {
  bookId: string
  orderId: string
  pdfUrl: string
  characterName: string
  characterGender: string
}

interface StripeCheckoutData {
  bookId: string
  orderId: string
  customerEmail?: string
  customerName?: string
  amount: number
  currency: string
  shippingAddress?: any
}

interface ApprovalNotificationData {
  bookId: string
  orderId: string
  status: 'approved' | 'declined'
  declineReason?: string
  pdfUrl?: string
  token: string
  customerEmail?: string
  customerName?: string
}

interface LeonardoFailureData {
  error: string
  failureReason?: string
  bookId?: string
  orderId?: string
  imageNumber?: string
  generationId?: string
  characterId?: string
  prompt?: string
  step?: string
  apiEndpoint?: string
  apiResponse?: string
  additionalContext?: Record<string, any>
}

interface PdfSentForApprovalData {
  bookId: string
  orderId: string
  customerEmail: string
  customerName?: string
  characterName?: string
  token: string
  smsAlsoSent?: boolean
  isResend?: boolean
}

interface BookShippedData {
  bookId: string
  orderId: string
  gelatoOrderId: string
  customerEmail?: string
  customerName?: string
  characterName?: string
  trackingNumber?: string
  trackingUrl?: string
  carrier?: string
  fulfillmentCountry?: string
}

interface BookDeliveredData {
  bookId: string
  orderId: string
  gelatoOrderId: string
  customerEmail?: string
  customerName?: string
  characterName?: string
  trackingNumber?: string
  carrier?: string
  fulfillmentCountry?: string
}

interface OrderUpdateData {
  orderId: string
  bookId?: string
  message: string
}

interface InngestFailureData {
  functionId: string
  functionName: string
  runId: string
  error: string
}

async function ensureOrderThread(orderId: string, bookId?: string): Promise<string | null> {
  // Check existing thread
  const { data, error } = await supabase
    .from('orders')
    .select('slack_thread_ts')
    .eq('id', orderId)
    .single()

  if (error) {
    console.error('Failed to fetch Slack thread TS:', error)
    return null
  }

  if (data?.slack_thread_ts) {
    return data.slack_thread_ts
  }

  if (!process.env.SLACK_BOT_TOKEN || !process.env.ORDER_TRACKING_SLACK_CHANNEL_ID) {
    console.warn('Slack bot token or channel ID not configured')
    return null
  }

  const timestamp = new Date()
  const formattedTime = timestamp.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  })

  const parentMessage = `🧾 Order ${orderId} for Book ${bookId || 'unknown'} - ${formattedTime}`

  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`
      },
      body: JSON.stringify({
        channel: process.env.ORDER_TRACKING_SLACK_CHANNEL_ID,
        text: parentMessage
      })
    })

    const result = await response.json()
    if (!result.ok) {
      console.error('Failed to create Slack parent message:', result)
      return null
    }

    const threadTs = result.ts as string

    await supabase
      .from('orders')
      .update({ slack_thread_ts: threadTs })
      .eq('id', orderId)

    return threadTs
  } catch (err) {
    console.error('Error creating Slack parent message:', err)
    return null
  }
}

export async function notifyOrderUpdate({ orderId, bookId, message }: OrderUpdateData) {
  if (!process.env.SLACK_BOT_TOKEN || !process.env.ORDER_TRACKING_SLACK_CHANNEL_ID) {
    console.warn('Slack bot token or channel ID not configured')
    return
  }

  const threadTs = await ensureOrderThread(orderId, bookId)
  if (!threadTs) return

  const timestamp = new Date()
  const formattedTime = timestamp.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  })

  const payload = {
    channel: process.env.ORDER_TRACKING_SLACK_CHANNEL_ID,
    text: `${message} - ${formattedTime}`,
    thread_ts: threadTs
  }

  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`
      },
      body: JSON.stringify(payload)
    })

    const result = await response.json()
    if (!result.ok) {
      console.error('Order tracking Slack notification failed:', result)
    }
  } catch (err) {
    console.error('Failed to send order tracking Slack notification:', err)
  }
}

export async function notifySlack({ error, failureReason, filePath, additionalContext = {} }: SlackNotificationData) {
  if (!process.env.VERIFY_IMAGE_SLACK_WEBHOOK_URL) {
    console.warn('VERIFY_IMAGE_SLACK_WEBHOOK_URL not configured')
    return
  }

  console.log('Attempting to send Slack notification')

  const timestamp = new Date()
  const formattedTime = timestamp.toLocaleString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    timeZoneName: 'short'
  })

  const message = {
    text: `<!here> Image Verification Failed: ${error}`, // Fallback text
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚨 Image Verification Failed',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `<!here> *Error:* ${error}\n*Time:* ${formattedTime}`
        }
      }
    ]
  }

  if (failureReason) {
    message.blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Failure Reason:*\n${failureReason}`
      }
    })
  }

  if (filePath) {
    message.blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*File Path:*\n\`${filePath}\``
      }
    })
  }

  if (Object.keys(additionalContext).length > 0) {
    message.blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Additional Context:*\n\`\`\`${JSON.stringify(additionalContext, null, 2)}\`\`\``
      }
    })
  }

  try {
    const response = await fetch(process.env.VERIFY_IMAGE_SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Slack notification failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        payload: JSON.stringify(message)
      })
    } else {
      console.log('Slack notification sent successfully')
    }
  } catch (err) {
    console.error('Failed to send Slack notification:', err)
  }
}

export async function notifyInngestFailure({ functionId, functionName, runId, error }: InngestFailureData) {
  if (!process.env.INNGEST_FAILURE_SLACK_WEBHOOK_URL) {
    console.warn('INNGEST_FAILURE_SLACK_WEBHOOK_URL not configured')
    return
  }

  const timestamp = new Date()
  const formattedTime = timestamp.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  })

  const message = {
    text: `<!here> Inngest Function Failed: ${functionName}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '⚠️ Inngest Function Failed',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `<!here> *Function:* ${functionName}\n*Error:* ${error}\n*Function ID:* ${functionId}\n*Run ID:* ${runId}\n*Time:* ${formattedTime}`
        }
      }
    ]
  }

  try {
    const response = await fetch(process.env.INNGEST_FAILURE_SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Inngest failure Slack notification failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        payload: JSON.stringify(message)
      })
    } else {
      console.log('Inngest failure Slack notification sent successfully')
    }
  } catch (err) {
    console.error('Failed to send Inngest failure Slack notification:', err)
  }
}

export async function notifyLeonardoFailure(failureData: LeonardoFailureData) {
  if (!process.env.LEONARDO_IMAGES_SLACK_WEBHOOK_URL) {
    console.warn('LEONARDO_IMAGES_SLACK_WEBHOOK_URL not configured')
    return
  }

  console.log('Sending Leonardo failure notification to Slack')

  const timestamp = new Date()
  const formattedTime = timestamp.toLocaleString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    timeZoneName: 'short'
  })

  const message = {
    text: `<!here> Failed Leonardo Image Generation: ${failureData.error}`, // Fallback text
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🎨❌ Failed Leonardo Image Generation',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `<!here> *Error:* ${failureData.error}\n*Time:* ${formattedTime}`
        }
      }
    ]
  }

  // Add failure reason if present
  if (failureData.failureReason) {
    message.blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Failure Reason:*\n${failureData.failureReason}`
      }
    })
  }

  // Add book/order details if present
  if (failureData.bookId || failureData.orderId) {
    const details = [];
    if (failureData.bookId) details.push(`Book ID: ${failureData.bookId}`);
    if (failureData.orderId) details.push(`Order ID: ${failureData.orderId}`);
    if (failureData.imageNumber) details.push(`Image: ${failureData.imageNumber}`);
    if (failureData.step) details.push(`Step: ${failureData.step}`);
    
    message.blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Details:*\n• ${details.join('\n• ')}`
      }
    })
  }

  // Add Leonardo-specific details if present
  if (failureData.generationId || failureData.characterId || failureData.apiEndpoint) {
    const leonardoDetails = [];
    if (failureData.generationId) leonardoDetails.push(`Generation ID: \`${failureData.generationId}\``);
    if (failureData.characterId) leonardoDetails.push(`Character ID: \`${failureData.characterId}\``);
    if (failureData.apiEndpoint) leonardoDetails.push(`API Endpoint: \`${failureData.apiEndpoint}\``);
    
    if (leonardoDetails.length > 0) {
      message.blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Leonardo Details:*\n• ${leonardoDetails.join('\n• ')}`
        }
      })
    }
  }

  // Add prompt if present (truncated for readability)
  if (failureData.prompt) {
    const truncatedPrompt = failureData.prompt.length > 200 
      ? failureData.prompt.substring(0, 200) + '...' 
      : failureData.prompt;
    
    message.blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Prompt:*\n\`${truncatedPrompt}\``
      }
    })
  }

  // Add API response if present
  if (failureData.apiResponse) {
    const truncatedResponse = failureData.apiResponse.length > 500 
      ? failureData.apiResponse.substring(0, 500) + '...' 
      : failureData.apiResponse;
      
    message.blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*API Response:*\n\`\`\`${truncatedResponse}\`\`\``
      }
    })
  }

  // Add additional context if present
  if (failureData.additionalContext && Object.keys(failureData.additionalContext).length > 0) {
    message.blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Additional Context:*\n\`\`\`${JSON.stringify(failureData.additionalContext, null, 2)}\`\`\``
      }
    })
  }

  try {
    const response = await fetch(process.env.LEONARDO_IMAGES_SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Leonardo failure Slack notification failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        payload: JSON.stringify(message)
      })
    } else {
      console.log('Leonardo failure Slack notification sent successfully')
    }
  } catch (err) {
    console.error('Failed to send Leonardo failure Slack notification:', err)
  }
}

export async function notifyBookCheckout(checkoutData: BookCheckoutData) {
  if (!process.env.CREATE_BOOK_SLACK_WEBHOOK_URL) {
    console.warn('CREATE_BOOK_SLACK_WEBHOOK_URL not configured')
    return
  }

  console.log('Sending book checkout notification to Slack')

  const timestamp = new Date()
  const formattedTime = timestamp.toLocaleString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    timeZoneName: 'short'
  })

  const message = {
    text: `<!here> New Book Checkout: ${checkoutData.bookId}`, // Fallback text
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '💰 New Book Checkout Started',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `<!here> *Book ID:* ${checkoutData.bookId}\n*Session ID:* ${checkoutData.sessionId}\n*Time:* ${formattedTime}`
        }
      }
    ]
  }

  try {
    const response = await fetch(process.env.CREATE_BOOK_SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Book checkout Slack notification failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        payload: JSON.stringify(message)
      })
    } else {
      console.log('Book checkout Slack notification sent successfully')
    }
  } catch (err) {
    console.error('Failed to send book checkout Slack notification:', err)
  }
}

export async function notifyGeneratedImage(imageData: GeneratedImageData) {
  if (!process.env.PREVIEW_IMAGE_SLACK_WEBHOOK_URL) {
    console.warn('PREVIEW_IMAGE_SLACK_WEBHOOK_URL not configured')
    return
  }

  // Only send notification if we have a duration (meaning generation is complete)
  if (!imageData.durationMs) {
    return
  }

  console.log('Sending generated image notification to Slack')

  const timestamp = new Date()
  const formattedTime = timestamp.toLocaleString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    timeZoneName: 'short'
  })

  const message = {
    text: `<!here> New Character Image Generated: ${imageData.name}`, // Fallback text
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '✨ New Character Image Generated',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `<!here> *Book ID:* ${imageData.bookId}\n*Time:* ${formattedTime}\n*Generation Time:* ${formatDuration(imageData.durationMs)}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Character Details:*\n• Name: ${imageData.name}\n• Gender: ${imageData.gender}\n• Age: ${imageData.age}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Appearance:*\n• Skin Tone: ${imageData.appearance.skinTone}\n• Hair: ${imageData.appearance.hair}`
        }
      }
    ]
  }

  // Add generated image if available
  if (imageData.generatedImageUrl) {
    message.blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Generated Cover Image:* ${imageData.generatedImageUrl}`
      }
    })
  }

  // Add additional generated images if available
  if (imageData.generatedImageUrls?.length) {
    message.blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Additional Generated Images:*\n${imageData.generatedImageUrls.map((url, index) => `${index + 1}. ${url}`).join('\n')}`
      }
    })
  }

  try {
    const response = await fetch(process.env.PREVIEW_IMAGE_SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Generated image Slack notification failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        payload: JSON.stringify(message)
      })
    } else {
      console.log('Generated image Slack notification sent successfully')
    }
  } catch (err) {
    console.error('Failed to send generated image Slack notification:', err)
  }
}

// Helper function to format duration in milliseconds to a human-readable string
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  
  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`
  }
  
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  
  return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`
}

export async function notifyPdfGeneration(pdfData: PdfGenerationData) {
  if (!process.env.CREATE_BOOK_SLACK_WEBHOOK_URL) {
    console.warn('CREATE_BOOK_SLACK_WEBHOOK_URL not configured')
    return
  }

  console.log('Sending PDF generation notification to Slack')

  const timestamp = new Date()
  const formattedTime = timestamp.toLocaleString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    timeZoneName: 'short'
  })

  let signedUrl: string | null = null
  if (process.env.NEXT_PUBLIC_APP_URL) {
    try {
      signedUrl = await refreshPdfUrl(pdfData.pdfUrl, process.env.NEXT_PUBLIC_APP_URL, 86400)
    } catch {
      console.warn('Private PDF link unavailable; omitting it from the notification')
    }
  }

  const message = {
    text: `<!here> New PDF Generated: ${pdfData.characterName}'s Book`, // Fallback text
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📚 New PDF Generated',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `<!here> *Book ID:* ${pdfData.bookId}\n*Order ID:* ${pdfData.orderId}\n*Time:* ${formattedTime}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Character Details:*\n• Name: ${pdfData.characterName}\n• Gender: ${pdfData.characterGender}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: signedUrl ? `*PDF Link:* ${signedUrl}\n_(Link expires in 24 hours)_` : 'PDF link temporarily unavailable. Open the administrator dashboard to retry.'
        }
      }
    ]
  }

  try {
    const response = await fetch(process.env.CREATE_BOOK_SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('PDF generation Slack notification failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        payload: JSON.stringify(message)
      })
    } else {
      console.log('PDF generation Slack notification sent successfully')
    }
  } catch (err) {
    console.error('Failed to send PDF generation Slack notification:', err)
  }
}

export async function notifyStripeCheckout(checkoutData: StripeCheckoutData) {
  if (!process.env.CREATE_BOOK_SLACK_WEBHOOK_URL) {
    console.warn('CREATE_BOOK_SLACK_WEBHOOK_URL not configured')
    return
  }

  console.log('Sending Stripe checkout notification to Slack')

  const timestamp = new Date()
  const formattedTime = timestamp.toLocaleString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    timeZoneName: 'short'
  })

  const message = {
    text: `<!here> New Book Purchase: ${checkoutData.customerName || 'Anonymous'}`, // Fallback text
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '💳 New Book Purchase',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `<!here> *Book ID:* ${checkoutData.bookId}\n*Order ID:* ${checkoutData.orderId}\n*Time:* ${formattedTime}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Customer Details:*\n• Name: ${checkoutData.customerName || 'Not provided'}\n• Email: ${checkoutData.customerEmail || 'Not provided'}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Payment Details:*\n• Amount: ${(checkoutData.amount / 100).toFixed(2)} ${checkoutData.currency.toUpperCase()}`
        }
      }
    ]
  }

  // Add shipping address if available
  if (checkoutData.shippingAddress) {
    message.blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Shipping Address:*\n\`\`\`${JSON.stringify(checkoutData.shippingAddress, null, 2)}\`\`\``
      }
    })
  }

  try {
    const response = await fetch(process.env.CREATE_BOOK_SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Stripe checkout Slack notification failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        payload: JSON.stringify(message)
      })
    } else {
      console.log('Stripe checkout Slack notification sent successfully')
    }
  } catch (err) {
    console.error('Failed to send Stripe checkout Slack notification:', err)
  }
}

export async function notifyApprovalStatus(approvalData: ApprovalNotificationData) {
  if (!process.env.PDF_SLACK_WEBHOOK_URL) {
    console.warn('PDF_SLACK_WEBHOOK_URL not configured')
    return
  }

  console.log('Sending approval status notification to Slack')

  const timestamp = new Date()
  const formattedTime = timestamp.toLocaleString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    timeZoneName: 'short'
  })

  const emoji = approvalData.status === 'approved' ? '✅' : '❌'
  const title = approvalData.status === 'approved' ? 'Book Approved' : 'Book Declined'

  const message = {
    text: `<!here> ${title}: ${approvalData.customerName || 'Anonymous Customer'}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} ${title}`,
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `<!here> *Book ID:* ${approvalData.bookId}\n*Order ID:* ${approvalData.orderId}\n*Time:* ${formattedTime}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Customer Details:*\n• Name: ${approvalData.customerName || 'Not provided'}\n• Email: ${approvalData.customerEmail || 'Not provided'}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Status:* ${approvalData.status.toUpperCase()}\n*Token:* \`${redactToken(approvalData.token)}\``
        }
      }
    ]
  }

  // Add decline reason if present
  if (approvalData.status === 'declined' && approvalData.declineReason) {
    message.blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Decline Reason:*\n\`\`\`${approvalData.declineReason}\`\`\``
      }
    })
  }

  // Add PDF URL if present
  if (approvalData.pdfUrl) {
    message.blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*PDF URL:* [REDACTED SIGNED URL]`
      }
    })
  }

  try {
    const response = await fetch(process.env.PDF_SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Approval status Slack notification failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        payload: JSON.stringify(message)
      })
    } else {
      console.log('Approval status Slack notification sent successfully')
    }
  } catch (err) {
    console.error('Failed to send approval status Slack notification:', err)
  }
}

export async function notifyPdfSentForApproval(pdfSentData: PdfSentForApprovalData) {
  if (!process.env.PDF_SLACK_WEBHOOK_URL) {
    console.warn('PDF_SLACK_WEBHOOK_URL not configured')
    return
  }

  console.log('Sending PDF sent for approval notification to Slack')

  const timestamp = new Date()
  const formattedTime = timestamp.toLocaleString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    timeZoneName: 'short'
  })

  const title = pdfSentData.isResend ? '📧 PDF Resent for Approval' : '📧 PDF Sent for Approval'
  const actionText = pdfSentData.isResend ? 'resent' : 'sent'

  const message = {
    text: `<!here> PDF ${actionText} for approval: ${pdfSentData.customerName || pdfSentData.customerEmail}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: title,
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `<!here> *Book ID:* ${pdfSentData.bookId}\n*Order ID:* ${pdfSentData.orderId}\n*Time:* ${formattedTime}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Customer Details:*\n• Name: ${pdfSentData.customerName || 'Not provided'}\n• Email: ${pdfSentData.customerEmail}`
        }
      }
    ]
  }

  // Add character name if available
  if (pdfSentData.characterName) {
    message.blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Character Name:* ${pdfSentData.characterName}`
      }
    })
  }

  // Add delivery method info
  const deliveryMethods = ['Email']
  if (pdfSentData.smsAlsoSent) {
    deliveryMethods.push('SMS')
  }

  message.blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*Delivery Method:* ${deliveryMethods.join(' + ')}\n*Token:* \`${pdfSentData.token.substring(0, 8)}...\``
    }
  })

  try {
    const response = await fetch(process.env.PDF_SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('PDF sent for approval Slack notification failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        payload: JSON.stringify(message)
      })
    } else {
      console.log('PDF sent for approval Slack notification sent successfully')
    }
  } catch (err) {
    console.error('Failed to send PDF sent for approval Slack notification:', err)
  }
}

export async function notifyBookShipped(shippedData: BookShippedData) {
  if (!process.env.BOOK_DELIVERY_SLACK_WEBHOOK_URL) {
    console.warn('BOOK_DELIVERY_SLACK_WEBHOOK_URL not configured')
    return
  }

  console.log('Sending book shipped notification to Slack')

  const timestamp = new Date()
  const formattedTime = timestamp.toLocaleString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    timeZoneName: 'short'
  })

  const message = {
    text: `<!here> Book Shipped: ${shippedData.customerName || shippedData.customerEmail || 'Order ' + shippedData.orderId}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📦 Book Shipped',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `<!here> *Book ID:* ${shippedData.bookId}\n*Order ID:* ${shippedData.orderId}\n*Gelato Order ID:* ${shippedData.gelatoOrderId}\n*Time:* ${formattedTime}`
        }
      }
    ]
  }

  // Add customer details if available
  if (shippedData.customerName || shippedData.customerEmail) {
    message.blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Customer Details:*\n• Name: ${shippedData.customerName || 'Not provided'}\n• Email: ${shippedData.customerEmail || 'Not provided'}`
      }
    })
  }

  // Add character name if available
  if (shippedData.characterName) {
    message.blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Character Name:* ${shippedData.characterName}`
      }
    })
  }

  // Add shipping details
  const shippingDetails = []
  if (shippedData.carrier) shippingDetails.push(`Carrier: ${shippedData.carrier}`)
  if (shippedData.fulfillmentCountry) shippingDetails.push(`Ship From: ${shippedData.fulfillmentCountry}`)
  if (shippedData.trackingNumber) shippingDetails.push(`Tracking: ${shippedData.trackingNumber}`)

  if (shippingDetails.length > 0) {
    message.blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Shipping Details:*\n• ${shippingDetails.join('\n• ')}`
      }
    })
  }

  // Add tracking URL if available
  if (shippedData.trackingUrl) {
    message.blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Track Package:* ${shippedData.trackingUrl}`
      }
    })
  }

  try {
    const response = await fetch(process.env.BOOK_DELIVERY_SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Book shipped Slack notification failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        payload: JSON.stringify(message)
      })
    } else {
      console.log('Book shipped Slack notification sent successfully')
    }
  } catch (err) {
    console.error('Failed to send book shipped Slack notification:', err)
  }
}

export async function notifyBookDelivered(deliveredData: BookDeliveredData) {
  if (!process.env.BOOK_DELIVERY_SLACK_WEBHOOK_URL) {
    console.warn('BOOK_DELIVERY_SLACK_WEBHOOK_URL not configured')
    return
  }

  console.log('Sending book delivered notification to Slack')

  const timestamp = new Date()
  const formattedTime = timestamp.toLocaleString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    timeZoneName: 'short'
  })

  const message = {
    text: `<!here> Book Delivered: ${deliveredData.customerName || deliveredData.customerEmail || 'Order ' + deliveredData.orderId}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🎉 Book Delivered',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `<!here> *Book ID:* ${deliveredData.bookId}\n*Order ID:* ${deliveredData.orderId}\n*Gelato Order ID:* ${deliveredData.gelatoOrderId}\n*Time:* ${formattedTime}`
        }
      }
    ]
  }

  // Add customer details if available
  if (deliveredData.customerName || deliveredData.customerEmail) {
    message.blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Customer Details:*\n• Name: ${deliveredData.customerName || 'Not provided'}\n• Email: ${deliveredData.customerEmail || 'Not provided'}`
      }
    })
  }

  // Add character name if available
  if (deliveredData.characterName) {
    message.blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Character Name:* ${deliveredData.characterName}`
      }
    })
  }

  // Add delivery details
  const deliveryDetails = []
  if (deliveredData.carrier) deliveryDetails.push(`Carrier: ${deliveredData.carrier}`)
  if (deliveredData.fulfillmentCountry) deliveryDetails.push(`Delivered In: ${deliveredData.fulfillmentCountry}`)
  if (deliveredData.trackingNumber) deliveryDetails.push(`Tracking: ${deliveredData.trackingNumber}`)

  if (deliveryDetails.length > 0) {
    message.blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Delivery Details:*\n• ${deliveryDetails.join('\n• ')}`
      }
    })
  }

  try {
    const response = await fetch(process.env.BOOK_DELIVERY_SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Book delivered Slack notification failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        payload: JSON.stringify(message)
      })
    } else {
      console.log('Book delivered Slack notification sent successfully')
    }
  } catch (err) {
    console.error('Failed to send book delivered Slack notification:', err)
  }
} 
