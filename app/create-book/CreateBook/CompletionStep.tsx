"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { BookData } from "@/types/book"
import { useState, useRef, useEffect } from "react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import Link from "next/link"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { ChevronLeft, ChevronRight, Truck, ShieldCheck } from "lucide-react"
import useEmblaCarousel from "embla-carousel-react"
import { Checkbox } from "@/components/ui/checkbox"
import { trackFacebookEvent } from "@/lib/facebook-pixel"
import { trackProceedToCheckout } from "@/lib/posthog-tracker"
import { Alert, AlertDescription } from "@/components/ui/alert"

const CarouselDots = ({ selectedIndex, itemsLength, onClick }: { selectedIndex: number, itemsLength: number, onClick: (index: number) => void }) => (
  <div className="flex justify-center gap-2 mt-4">
    {Array.from({ length: itemsLength }).map((_, i) => (
      <button
        key={i}
        onClick={() => onClick(i)}
        className="p-2"
        aria-label={`Go to slide ${i + 1}`}
        aria-current={selectedIndex === i ? 'true' : undefined}
      >
        <span
          className={`block h-2 w-2 rounded-full transition-colors ${
            selectedIndex === i ? 'bg-primary' : 'bg-gray-300'
          }`}
        />
      </button>
    ))}
  </div>
)

interface CompletionStepProps {
  bookData: BookData
  onRestart: () => void
}

const COMPLETION_FAQS = [
  {
    question: "How long does it take to receive the book?",
    answer: "After you approve the final preview, books typically take 9-12 days for printing and shipping within the US. Each book is carefully printed and bound to ensure the highest quality. Shipping is free."
  },
  {
    question: "Can I preview the book before ordering?",
    answer: "While you cannot preview the entire book before ordering, you will receive a complete digital preview of your personalized book via email within 24 hours of your purchase. This includes all illustrations and text, allowing you to ensure you're completely satisfied with how your child is represented in the story before it's printed. If there are any issues we will work with you to fix them."
  },
  {
    question: "What if I'm not satisfied with the result?",
    answer: "Your satisfaction is our priority. If you're not happy with the initial character illustration, we offer unlimited revisions until you're completely satisfied. You can provide specific feedback, and our team will adjust the illustration accordingly."
  }
]

export function CompletionStep({ bookData, onRestart }: CompletionStepProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [checkoutAccessExpired, setCheckoutAccessExpired] = useState(false)
  const [isSticky, setIsSticky] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const [smsOptIn, setSmsOptIn] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const [emblaRef, emblaApi] = useEmblaCarousel(isMobile ? { 
    loop: false,
    align: "center",
    slidesToScroll: 1,
    containScroll: "trimSnaps",
    dragFree: false,
    startIndex: 0,
    skipSnaps: false
  } : undefined)

  useEffect(() => {
    const checkScroll = () => {
      if (!containerRef.current) return

      const isMobile = window.innerWidth < 768
      if (!isMobile) {
        setIsSticky(false)
        return
      }

      const mainContent = containerRef.current.closest(".flex-grow")
      if (!mainContent) return

      const contentHeight = mainContent.scrollHeight
      const viewportHeight = window.innerHeight
      const headerHeight = 68

      setIsSticky(contentHeight > viewportHeight - headerHeight)
    }

    // Initial check
    checkScroll()
    
    // Add event listeners
    window.addEventListener("resize", checkScroll)
    window.addEventListener("scroll", checkScroll)
    
    // Add listeners for accordion triggers
    const accordionTriggers = document.querySelectorAll('[data-state]')
    accordionTriggers.forEach(trigger => {
      trigger.addEventListener('click', () => {
        // Use setTimeout to allow the accordion to expand/collapse first
        setTimeout(checkScroll, 100)
      })
    })
    
    return () => {
      window.removeEventListener("resize", checkScroll)
      window.removeEventListener("scroll", checkScroll)
      // No need to remove accordion listeners as they'll be cleaned up when component unmounts
    }
  }, [])

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleNext = () => {
    emblaApi?.scrollNext()
  }

  const handlePrev = () => {
    emblaApi?.scrollPrev()
  }

  useEffect(() => {
    if (!emblaApi) return

    const onSelect = () => {
      setCurrentImageIndex(emblaApi.selectedScrollSnap())
    }

    emblaApi.on('select', onSelect)
    onSelect() // Set initial index

    return () => {
      emblaApi.off('select', onSelect)
    }
  }, [emblaApi])

  const handleSmsOptInChange = (checked: boolean) => {
    setSmsOptIn(checked);
    trackFacebookEvent("sms_optin_toggled", { value: checked });
  }

  const handleCheckout = async () => {
    if (isLoading || checkoutAccessExpired) return
    setCheckoutError(null)
    try {
      setIsLoading(true)
      // Save current state before redirecting
      try { localStorage.setItem('bookData', JSON.stringify(bookData)) } catch { /* A saved snapshot is optional for checkout. */ }
      
      await trackProceedToCheckout({
        bookId: bookData.id!,
        name: bookData.name,
        gender: bookData.gender,
        age: bookData.age!,
        smsOptIn: smsOptIn
      })
      
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookId: bookData.id,
          smsOptIn: smsOptIn,
        }),
      })

      const result = await response.json().catch(() => null)
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        setCheckoutAccessExpired(true)
        setCheckoutError("This browser can no longer access this preview. Please start a new book to continue.")
        return
      }
      if (!response.ok || typeof result?.sessionUrl !== 'string') {
        setCheckoutError(response.status === 429
          ? "You've made several checkout attempts. Please wait a few minutes and try again."
          : "We couldn't open checkout. Please try again in a moment.")
        return
      }
      const checkoutUrl = new URL(result.sessionUrl)
      if (checkoutUrl.protocol !== 'https:' || checkoutUrl.hostname !== 'checkout.stripe.com' || checkoutUrl.username || checkoutUrl.password) {
        setCheckoutError("We couldn't open checkout. Please try again in a moment.")
        return
      }
      window.location.assign(checkoutUrl.href)
    } catch {
      setCheckoutError("We couldn't connect to checkout. Check your connection and try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const checkoutButton = (
    <div className="space-y-3">
      {checkoutError && <Alert variant="destructive"><AlertDescription>{checkoutError}</AlertDescription></Alert>}
      {checkoutAccessExpired ? (
        <Button size="lg" onClick={onRestart} className="w-full font-medium">Start a new book</Button>
      ) : (
        <Button size="lg" onClick={handleCheckout} className="w-full font-medium" disabled={isLoading}>
          {isLoading ? <LoadingSpinner /> : "Proceed to Checkout"}
        </Button>
      )}
    </div>
  )

  const getEstimatedDeliveryDate = () => {
    const today = new Date();
    let currentDate = new Date(today);

    currentDate.setDate(today.getDate() + 14); // Add 14 calendar days

    return currentDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric'
    });
  }

  return (
    <div className={`flex flex-col min-h-full ${isMobile ? 'overflow-x-hidden' : ''}`}>
      <div className="flex-grow p-4 md:p-6">
        <div className="max-w-xl mx-auto space-y-8 md:space-y-12">
          {/* Header */}
          <div className="space-y-2 text-center">
            <h2 className="text-2xl md:text-4xl font-semibold tracking-tight">
              A Sneak Peek at Your Book
            </h2>
            <p className="text-muted-foreground">
              Remember you can approve the full book preview before it goes to print.
            </p>
            <div className="flex items-start justify-center space-x-2 max-w-md mx-auto">
              <Checkbox 
                id="sms-opt-in" 
                checked={smsOptIn} 
                onCheckedChange={handleSmsOptInChange}
                aria-checked={smsOptIn}
              />
              <label 
                htmlFor="sms-opt-in" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Send me a one-time SMS with my full PDF book preview
              </label>
            </div>
          </div>

          {/* Preview Carousel */}
          <div className="flex flex-col items-center space-y-6 md:space-y-8">
            <div className="relative group w-full">
              {isMobile ? (
                <div className="overflow-visible" ref={emblaRef}>
                  <div className="flex [&>*]:mx-1">
                    {bookData.generated_image_urls?.map((src, i) => (
                      <div key={i} className="relative min-w-[95%] aspect-square">
                        <Image
                          src={src}
                          alt={`Generated image ${i + 1}`}
                          fill
                          className="object-cover rounded-xl"
                          sizes="95vw"
                          quality={85}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex justify-center gap-8 -mx-40">
                  <div className="flex w-full justify-center gap-8">
                    {bookData.generated_image_urls?.map((src, i) => (
                      <div key={i} className="relative w-[42vw] max-w-[700px] min-w-[450px] aspect-square">
                        <Image
                          src={src}
                          alt={`Generated image ${i + 1}`}
                          fill
                          className="object-cover rounded-xl"
                          sizes="42vw"
                          quality={85}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Carousel Dots - only visible on mobile */}
              {isMobile && (
                <CarouselDots
                  selectedIndex={currentImageIndex}
                  itemsLength={bookData.generated_image_urls?.length || 0}
                  onClick={setCurrentImageIndex}
                />
              )}
            </div>
            <h3 className="text-3xl font-bold tracking-tight text-center mb-8 md:mb-12">
              {bookData.name}
            </h3>
          </div>

          {/* Desktop Buttons */}
          <div className="hidden md:block space-y-4">
            {checkoutButton}
            {bookData.remainingUploads > 0 ? (
              <Button
                variant="link"
                size="lg"
                onClick={onRestart}
                className="w-full font-medium underline"
              >
                Try Another Photo
              </Button>
            ) : (
              <Button
                variant="outline"
                size="lg"
                onClick={() =>
                  (window.location.href = "mailto:support@example.com?subject=Help%20with%20my%20book")
                }
                className="w-full"
              >
                Email Us For Help
              </Button>
            )}
          </div>

          {/* New callout section */}
          <div className="hidden md:flex justify-center pt-4">
             <div className="w-full max-w-md">
               <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                 <div className="flex items-start">
                   <Truck className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                   <div>
                     <h3 className="font-medium text-gray-900">Estimated Delivery</h3>
                     <p className="text-sm text-gray-600">
                       Order today and receive your book by <span className="font-semibold">{getEstimatedDeliveryDate()}</span>
                     </p>
                   </div>
                 </div>
                 <div className="flex items-start">
                   <ShieldCheck className="h-5 w-5 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
                   <div>
                     <h3 className="font-medium text-gray-900">100% Satisfaction Guarantee</h3>
                     <p className="text-sm text-gray-600">We offer a full refund</p>
                   </div>
                 </div>
               </div>
             </div>
           </div>

          {/* Desktop FAQs */}
          <div className="hidden md:block pt-4">
            <Accordion type="single" collapsible className="w-full text-left">
              {COMPLETION_FAQS.map((item, i) => (
                <AccordionItem key={i} value={`item-${i}`}>
                  <AccordionTrigger className="text-lg sm:text-xl font-semibold py-6 text-left">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-base sm:text-lg text-muted-foreground">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Section */}
      <div className="md:hidden">
        {/* Mobile Sticky Buttons */}
        <div 
          ref={containerRef}
          className={`${
            isSticky 
              ? "fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg" 
              : "relative"
          } p-4 z-40`}
        >
          <div className="max-w-2xl mx-auto">
            {checkoutButton}
            {bookData.remainingUploads > 0 ? (
              <Button
                variant="link"
                size="lg"
                onClick={onRestart}
                className="w-full font-medium underline"
              >
                Try Another Photo
              </Button>
            ) : (
              <Button
                variant="outline"
                size="lg"
                onClick={() => (window.location.href = "mailto:support@example.com?subject=Help%20with%20my%20book")}
                className="w-full"
              >
                Email Us For Help
              </Button>
            )}
          </div>
        </div>

        {/* Mobile FAQs */}
        <div className="p-4 pb-32">
          {/* New callout section */}
           <div className="flex justify-center pb-4">
             <div className="w-full max-w-md">
               <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                 <div className="flex items-start">
                   <Truck className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                   <div>
                     <h3 className="font-medium text-gray-900">Estimated Delivery</h3>
                     <p className="text-sm text-gray-600">
                       Order today and receive your book by <span className="font-semibold">{getEstimatedDeliveryDate()}</span>
                     </p>
                   </div>
                 </div>
                 <div className="flex items-start">
                   <ShieldCheck className="h-5 w-5 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
                   <div>
                     <h3 className="font-medium text-gray-900">100% Satisfaction Guarantee</h3>
                     <p className="text-sm text-gray-600">We offer a full refund</p>
                   </div>
                 </div>
               </div>
             </div>
           </div>
          <Accordion type="single" collapsible className="w-full text-left">
            {COMPLETION_FAQS.map((item, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-lg sm:text-xl font-semibold py-6 text-left">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-base sm:text-lg text-muted-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  )
}
