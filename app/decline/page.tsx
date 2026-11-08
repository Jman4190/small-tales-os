"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { XCircle } from "lucide-react"
import Link from "next/link"
import { Header } from "@/components/header"

export default function DeclinePage() {
  return (
    <>
      <Header />
      <Suspense
        fallback={
          <main className="min-h-screen bg-white pt-[68px]">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
              <div className="rounded-xl border p-6 shadow-sm">
                <div className="flex min-h-[60vh] items-center justify-center">
                  <div className="animate-pulse text-muted-foreground">Loading...</div>
                </div>
              </div>
            </div>
          </main>
        }
      >
        <DeclineContent />
      </Suspense>
    </>
  )
}

function DeclineContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function checkDeclineStatus() {
      if (!token) {
        setError("Token is missing")
        setLoading(false)
        return
      }
      try {
        const res = await fetch(`/api/validate-token?token=${token}`)
        const data = await res.json()
        
        if (data.error) {
          setError(data.error)
        } else if (data.status !== 'declined') {
          setError("This book hasn't been declined")
        }
      } catch (err) {
        console.error("[decline] Error:", err)
        setError("Failed to check decline status")
      } finally {
        setLoading(false)
      }
    }
    checkDeclineStatus()
  }, [token])

  if (loading) {
    return (
      <main className="min-h-screen bg-white pt-[68px]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="rounded-xl border p-6 shadow-sm">
            <div className="flex min-h-[60vh] items-center justify-center">
              <div className="animate-pulse text-muted-foreground">Processing your feedback...</div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-white pt-[68px]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="rounded-xl border p-6 shadow-sm">
            <div className="text-center text-red-600">{error}</div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="rounded-xl border p-6 shadow-sm">
          <div className="flex flex-col items-center text-center space-y-8">
            <div className="rounded-full bg-red-100 p-4">
              <XCircle className="h-12 w-12 text-red-600" />
            </div>

            <div className="space-y-4">
              <h1 className="text-3xl font-bold tracking-tight">We're sorry you're not satisfied</h1>
              <p className="text-muted-foreground max-w-md mx-auto">
                We appreciate your feedback, and we're committed to making this right.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold">What's next?</h2>
              <ul className="text-muted-foreground max-w-md mx-auto space-y-2">
                <li>We'll reach out via email shortly to discuss your concerns in more detail.</li>
              </ul>
            </div>

            <div className="flex flex-col space-y-4 w-full max-w-xs">
              <Link href="/" className="w-full">
                <Button size="lg" className="w-full">
                  Return Home
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
