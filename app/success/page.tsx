// /app/success/page.tsx
"use client";

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { trackPostHogEvent } from '@/lib/posthog-tracker'

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-white pt-[68px]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="rounded-xl border p-6 shadow-sm">
            <div className="flex min-h-[60vh] items-center justify-center">
              <div className="animate-pulse text-muted-foreground">Loading...</div>
            </div>
          </div>
        </div>
      </main>
    }>
      <SuccessContent />
    </Suspense>
  )
}

function SuccessContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session_id")
  const [loading, setLoading] = useState(true)
  const [customerEmail, setCustomerEmail] = useState("")
  const [currency, setCurrency] = useState("USD")
  const [value, setValue] = useState(0)
  const [orderId, setOrderId] = useState<string | null>(null)

  useEffect(() => {
    const verifySession = async () => {
      try {
        const response = await fetch(`/api/stripe/verify-session?session_id=${sessionId}`)
        const data = await response.json()
        
        if (!data.success) {
          window.location.href = "/"
        } else {
          setCustomerEmail(data.customerEmail || "")
          setCurrency(data.currency || "USD")
          setValue(data.value || 0)
          setOrderId(data.orderId || null)
          localStorage.setItem('hasCompletedCheckout', 'true')

          // Facebook Pixel tracking with event_id for deduplication
          if (typeof window.fbq === 'function' && data.orderId) {
            const eventId = `purchase_${data.orderId}`
            
            window.fbq('track', 'Purchase', {
              currency: data.currency || "USD",
              value: data.value || 0
            }, {
              eventID: eventId
            });
            console.log('FB Pixel Purchase event tracked:', { 
              currency: data.currency, 
              value: data.value,
              eventID: eventId 
            });
          } else {
            console.warn('window.fbq not found or orderId missing, FB Pixel not loaded?');
          }

          await trackPostHogEvent('Purchase', {
            currency: data.currency || 'USD',
            value: data.value || 0,
            revenue: data.value || 0,
          })
        }
      } catch (error) {
        console.error("Error verifying session:", error)
      } finally {
        setLoading(false)
      }
    }

    if (sessionId) {
      verifySession()
    }
  }, [sessionId])

  if (loading) {
    return (
      <main className="min-h-screen bg-white pt-[68px]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="rounded-xl border p-6 shadow-sm">
            <div className="flex min-h-[60vh] items-center justify-center">
              <div className="animate-pulse text-muted-foreground">Verifying your purchase...</div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-white pt-[68px]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="rounded-xl border p-6 shadow-sm">
          <div className="flex flex-col items-center text-center space-y-8">
            <div className="rounded-full bg-green-100 p-4">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">Thank You for Your Purchase!</h1>
              <p className="text-muted-foreground max-w-md mx-auto mb-8">
                Your book preview will be ready within 24 hours. We'll send an email to <span className="font-bold">{customerEmail}</span> for your final approval. If this
                email is not correct, please contact us immediately.
              </p>
            </div>

            <div className="flex flex-col space-y-8 w-full max-w-xs">
              <div className="text-muted-foreground">
                <a href="mailto:support@example.com">support@example.com</a>
              </div>
              <Link href="/" className="w-full">
                <Button size="lg" className="w-full">
                  Return to Storybook Starter
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
} 