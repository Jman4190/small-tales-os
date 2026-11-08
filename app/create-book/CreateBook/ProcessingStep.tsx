"use client"

import { useEffect, useState, useRef } from "react"
import { Upload, ImageIcon, Sparkles, Wand2, AlertTriangle, Info, ClipboardCheck, ScrollText } from "lucide-react"
import type { BookData } from "@/types/book"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { SparklesText } from "@/components/ui/sparkles-text"
import Image from "next/image"
import { logInfo } from "@/lib/client-logger"

interface ProcessingStepProps {
  bookData: BookData
  onComplete: (imageUrls: string[]) => void
}

const messages = [
  {
    icon: ClipboardCheck,
    text: "Reviewing your details",
  },
  {
    icon: ScrollText,
    text: "Weaving your tales",
  },
  {
    icon: Wand2,
    text: "Preparing your character",
  },
  {
    icon: Sparkles,
    text: "AI is working its magic",
  },
  {
    icon: Upload,
    text: "Getting your book ready",
  },  
]

export function ProcessingStep({ bookData, onComplete }: ProcessingStepProps) {
  const [progress, setProgress] = useState(0)
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isImageLoaded, setIsImageLoaded] = useState(false)
  const startTimeRef = useRef<number>(Date.now())

  // Rotate between messages
  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true)
      setTimeout(() => {
        setCurrentMessageIndex((prev) => (prev + 1) % messages.length)
        setIsTransitioning(false)
      }, 200)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const checkStatus = async () => {
    if (!bookData.id) return
    
    try {
      const response = await fetch(`/api/book-status/${bookData.id}`)
      const data = await response.json()

      if (data.error) {
        setError("Unable to generate your character. Please try again.")
        return
      }

      if (data.data.status === "completed" && data.data.generated_image_urls?.length > 0) {
        const endTime = Date.now()
        const duration = endTime - startTimeRef.current
        
        // Log the generation time on client side
        logInfo("character_generation_completed", { 
          bookId: bookData.id,
          durationMs: duration,
          startTime: new Date(startTimeRef.current).toISOString(),
          endTime: new Date(endTime).toISOString()
        })
        
        // Also notify via API endpoint (will handle the Slack notification)
        fetch('/api/slack/character-generation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookId: bookData.id,
            name: bookData.name,
            gender: bookData.gender,
            age: bookData.age,
            appearance: bookData.appearance,
            generatedImageUrls: data.data.generated_image_urls,
            durationMs: duration
          })
        }).catch(err => console.error("Failed to send generation notification:", err))
        
        setProgress(100)
        onComplete(data.data.generated_image_urls)
      } else if (data.data.status === "failed") {
        setError("We couldn't generate your character right now. Please try again.")
      } else {
        setProgress((prev) => Math.min(prev + 5, 95))
      }
    } catch (err) {
      console.error("Error checking status:", err)
      setError("There was a problem connecting to our servers. Please try again.")
    }
  }

  // Use checkStatus in the effect
  useEffect(() => {
    if (!bookData.id) return
    const interval = setInterval(checkStatus, 2500)
    return () => clearInterval(interval)
  }, [bookData.id, onComplete])

  // Debug: Log the computed background style of our gradient element.
  useEffect(() => {
    const bgEl = document.querySelector(".processing-step-background")
    if (bgEl) {
      console.log("Computed background style:", getComputedStyle(bgEl).background)
    } else {
      console.warn("No .processing-step-background element found")
    }
  }, [])

  const CurrentIcon = messages[currentMessageIndex].icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <Image
          src="/release-placeholder.svg"
          alt="Background illustration"
          fill
          priority
          quality={90}
          sizes="100vw"
          className={`object-cover transition-opacity duration-300 ${
            isImageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoadingComplete={() => setIsImageLoaded(true)}
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/50" />
      </div>
      
      {/* Content */}
      <div className="relative z-10 w-full max-w-2xl mx-auto px-4">
        <div className="text-center space-y-8">
          <SparklesText 
            text={`Crafting ${bookData.name}'s Character`}
            colors={{ first: "#FFFFFF", second: "#FFFFFF" }}
            className="text-3xl font-serif tracking-tight text-white"
          />

          <div className="space-y-8">
            <div className="flex flex-col items-center justify-center min-h-[160px]">
              <div className={cn("transition-opacity duration-200 mb-8", isTransitioning ? "opacity-0" : "opacity-100")}>
                <CurrentIcon className="h-16 w-16 text-white" />
              </div>
              <p
                className={cn(
                  "text-white/90 text-xl font-serif italic transition-opacity duration-200",
                  isTransitioning ? "opacity-0" : "opacity-100"
                )}
              >
                {messages[currentMessageIndex].text}
              </p>
            </div>
            <div className="space-y-2 max-w-md mx-auto">
              <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white transition-all duration-500 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-center text-white/90">{progress}% complete</p>
            </div>
            {error ? (
              <Alert variant="destructive" className="bg-red-500/90 border-red-400 text-white">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Something went wrong</AlertTitle>
                <AlertDescription className="space-y-4">
                  <p>{error}</p>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setError(null)
                      setProgress(0)
                      checkStatus()
                    }}
                    className="bg-white text-red-500 hover:bg-white/90"
                  >
                    Try again
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}