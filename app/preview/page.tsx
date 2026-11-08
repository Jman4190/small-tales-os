// /app/preview/page.tsx
"use client";

import { useState, useEffect, Suspense, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { PreviewModal } from "../../components/preview-modal"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { FeedbackModal } from "@/components/feedback-modal"
import { PDFViewer } from "@/components/pdf-viewer"
import { Header } from "@/components/header"
import { CheckCircle2, XCircle, Sparkles, BookOpen, Wand2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

function PreviewContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [validationLoading, setValidationLoading] = useState(true)
  const [pdfLoading, setPdfLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoApproved, setAutoApproved] = useState(false)
  const [alreadyProcessed, setAlreadyProcessed] = useState<"approved" | "declined" | null>(null)
  const [pdfLoaded, setPdfLoaded] = useState(false)

  const [isModalOpen, setIsModalOpen] = useState(true)
  const [isDeclineFormOpen, setIsDeclineFormOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  // Add a ref to track if we've already started loading the PDF
  const pdfLoadInitiatedRef = useRef(false)
  
  // Separate validation and PDF loading
  useEffect(() => {
    if (!token) {
      console.error("No token found")
      setError("No token found")
      setValidationLoading(false)
      setPdfLoading(false)
      return
    }
    
    // Only proceed with validation and PDF loading if we haven't started loading already
    if (pdfLoadInitiatedRef.current) {
      return;
    }
    
    pdfLoadInitiatedRef.current = true;
    
    // Validate token
    fetch(`/api/validate-token?token=${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
          setPdfLoading(false)
        } else {
          // Check if the token has already been processed (approved/declined)
          if (data.status === "approved" || data.status === "declined") {
            setAlreadyProcessed(data.status)
            setPdfLoading(false)
          } else {
            setAutoApproved(data.autoApproved)
            
            // Start loading PDF if we have a URL
            if (data.pdfUrl) {
              setPdfUrl(data.pdfUrl)
              setPdfLoading(false)
            } else {
              console.error("[preview] No pdfUrl available in validate-token response:", data)
              setError("No pdfUrl available")
              setPdfLoading(false)
            }
          }
        }
      })
      .catch((err) => {
        console.error("[preview] Validate-token fetch failed:", err)
        setError("Failed to validate token")
        setPdfLoading(false)
      })
      .finally(() => setValidationLoading(false))
  }, [token])

  const handleApprove = async () => {
    // Show processing state
    setIsProcessing(true);
    
    try {
      // Make the API call
      const res = await fetch("/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        // Redirect after successful response
        window.location.href = `/approve${token ? `?token=${token}&notified=true` : "?notified=true"}`;
      } else {
        setError(data.error || "Failed to approve");
        setIsProcessing(false);
      }
    } catch (err) {
      console.error("[preview] Approval error:", err);
      setError("Failed to approve");
      setIsProcessing(false);
    }
  };

  const handleDecline = () => {
    setIsDeclineFormOpen(true)
  }

  const handleDeclineSubmit = async (feedback: { reason: string; otherText?: string }) => {
    const declineReason = feedback.otherText || feedback.reason;
    setIsDeclineFormOpen(false);
    setIsProcessing(true);
    
    try {
      const res = await fetch("/api/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, decline_reason: declineReason }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        // Redirect after successful response
        window.location.href = `/decline${token ? `?token=${token}&notified=true` : "?notified=true"}`;
      } else {
        setError(data.error || "Failed to submit decline feedback");
        setIsDeclineFormOpen(false);
        setIsProcessing(false);
      }
    } catch (err) {
      console.error("[preview] Decline submission error:", err);
      setError("Failed to submit decline feedback");
      setIsDeclineFormOpen(false);
      setIsProcessing(false);
    }
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
  }

  // Determine what content to show
  let mainContent;
  if (validationLoading) {
    mainContent = (
      <div className="h-[calc(100vh-200px)] flex items-center justify-center">
        <span>Loading token information...</span>
      </div>
    )
  } else if (error) {
    mainContent = <div className="p-4 text-red-500">{error}</div>
  } else if (alreadyProcessed) {
    mainContent = (
      <div className="p-4">
        <h2 className="text-xl font-semibold">
          This Book Preview has already been {alreadyProcessed === "approved" ? "approved" : "declined"}.
        </h2>
        <p>
          If this is a mistake then contact{" "}
          <a href="mailto:support@example.com" className="underline">
            support@example.com
          </a>{" "}
          immediately.
        </p>
      </div>
    )
  } else if (autoApproved) {
    mainContent = (
      <div className="p-4">
        <h2 className="text-xl font-semibold">Your preview was auto-approved.</h2>
        <p>Your token has expired. We automatically approved and triggered the print job.</p>
        <Button onClick={() => router.push(`/approve${token ? `?token=${token}&notified=true` : "?notified=true"}`)}>
          Continue
        </Button>
      </div>
    )
  } else {
    // PDF viewer - now we show loading state within the PDF container
    mainContent = (
      <div className="bg-white rounded-lg shadow-md overflow-hidden h-[calc(100vh-200px)] relative w-full">
        <div className="w-full h-full" style={{ minHeight: '300px' }}>
          {pdfLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Sparkles className="h-10 w-10 text-primary animate-pulse mx-auto mb-4" />
                <p className="text-muted-foreground">Loading your magical book preview...</p>
              </div>
            </div>
          ) : (
            <PDFViewer 
              url={pdfUrl ?? ''} 
              onError={(error) => {
                console.error('[Preview] PDF viewer error:', error);
                setError(error.message);
              }}
            />
          )}
        </div>
        <div
          className="absolute inset-0"
          onContextMenu={(e) => e.preventDefault()}
          style={{ pointerEvents: "none" }}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen font-sans overflow-hidden">
      <Header />
      
      {isProcessing ? (
        // Full-page processing overlay without any content behind it
        <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 shadow-xl text-center max-w-md">
            <Loader2 className="h-16 w-16 text-primary animate-spin mx-auto mb-6" />
            <p className="text-xl font-medium">
              Hang tight while we process your feedback
            </p>
          </div>
        </div>
      ) : (
        // Only render main content when not processing
        <>
          <main
            className={`flex-grow p-4 pb-16 md:pb-4 w-full max-w-full transition-all duration-300 ${
              isModalOpen || isDeclineFormOpen ? "blur-sm" : ""
            }`}
          >
            <div className="max-w-6xl mx-auto w-full">
              {mainContent}
            </div>
          </main>
          
          {/* Only show the action buttons if not in autoApproved mode AND not already processed */}
          {!autoApproved && !alreadyProcessed && !pdfLoading && (
            <div
              className={`fixed bottom-0 inset-x-0 w-full bg-background border-t border-border px-4 py-4 transition-all duration-300 ${
                isModalOpen || isDeclineFormOpen ? "blur-sm" : ""
              }`}
            >
              <div className="flex flex-col md:flex-row-reverse md:justify-center items-center gap-4 max-w-6xl mx-auto">
                <Button
                  onClick={handleApprove}
                  size="lg"
                  className="w-full md:w-[160px] bg-green-500 hover:bg-green-600"
                  disabled={isModalOpen || isDeclineFormOpen}
                >
                  Approve
                </Button>
                <button
                  onClick={handleDecline}
                  className="text-destructive underline hover:text-destructive/80 transition-colors w-full md:w-[160px] text-center"
                  disabled={isModalOpen || isDeclineFormOpen}
                >
                  Decline
                </button>
              </div>
            </div>
          )}
          
          <PreviewModal isOpen={isModalOpen} onClose={handleModalClose} />
          <FeedbackModal 
            isOpen={isDeclineFormOpen} 
            onClose={() => setIsDeclineFormOpen(false)}
            onSubmit={handleDeclineSubmit}
            isSubmitting={false}
          />
        </>
      )}
    </div>
  )
}

export default function PreviewPage() {
  return (
    <Suspense fallback={<div className="p-4">Loading...</div>}>
      <PreviewContent />
    </Suspense>
  )
}
