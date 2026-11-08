"use client"

import { useState, useRef, useEffect } from "react"
import { Upload, ImageIcon, CheckCircle2, X, ChevronLeft, ArrowLeft, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ButtonRow } from "../components/ButtonRow"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Image from "next/image"
import type { BookData } from "@/types/book"
import { VerificationModal } from "../components/verification-modal"
import type { ImageVerificationResponse } from "@/types/verification"
import type React from "react"
import { ImageCropModal } from "../components/ImageCropModal"
import { v4 as uuidv4 } from 'uuid'
import { trackPhotoUploaded } from "@/lib/posthog-tracker"

interface ImageUploadStepProps {
  bookData: BookData
  onNext: (filePath: string) => void
  onBack: () => void
  updateBookData: (data: Partial<BookData>) => void
}

// Add this near the top of the file, outside the component
const DisabledOverlay = () => (
  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 z-10">
    <p className="text-lg font-semibold text-center text-muted-foreground">
      No more uploads available today
    </p>
    <p className="text-sm text-center text-muted-foreground mt-1">
      Please try again tomorrow
    </p>
  </div>
)

const convertHeicToJpeg = async (file: File): Promise<File> => {
  if (!file.type.includes('heic') && !file.name.toLowerCase().includes('heic')) return file
  
  // Using heic2any instead
  const heic2any = (await import('heic2any')).default
  const convertedBlob = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.9
  });
  
  // Handle both single and multiple outputs
  const outputBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
  return new File([outputBlob], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' });
}

export function ImageUploadStep({ bookData, onNext, onBack, updateBookData }: ImageUploadStepProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState<boolean>(false)
  const [isVerifying, setIsVerifying] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showCropModal, setShowCropModal] = useState(false)
  const [tempPreview, setTempPreview] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [sessionUploadAttempts, setSessionUploadAttempts] = useState<number>(0)
  const [visitorId, setVisitorId] = useState<string>('')

  // Generate or retrieve a visitor ID when component mounts
  useEffect(() => {
    // Try to get existing visitor ID from localStorage
    const storedVisitorId = localStorage.getItem('visitorId') || uuidv4()
    
    // If it's new, save it
    if (!localStorage.getItem('visitorId')) {
      localStorage.setItem('visitorId', storedVisitorId)
    }
    
    setVisitorId(storedVisitorId)
  }, [])

  // Update useEffect to run when component mounts and when navigating back
  useEffect(() => {
    if (window.innerWidth < 768) {
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }, [preview]) // Add preview as dependency since it resets when navigating back

  const verifyImage = async (filePath: string): Promise<ImageVerificationResponse> => {
    const response = await fetch("/api/verify-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath }),
    })

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || "Verification failed")
    }

    return data
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Track attempt locally but don't send to server yet
    const newAttemptCount = sessionUploadAttempts + 1
    setSessionUploadAttempts(newAttemptCount)
    
    // Log to console only for development
    console.log(`Upload attempt ${newAttemptCount} in session. Remaining uploads: ${bookData.remainingUploads}`)

    try {
      const processedFile = await convertHeicToJpeg(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setTempPreview(reader.result as string)
        setShowCropModal(true)
      }
      reader.readAsDataURL(processedFile)
    } catch (err) {
      console.error('Error processing file:', err)
      setError('Failed to process image. Please try a different format.')
    }
  }

  const handleCropComplete = async (croppedImageUrl: string) => {
    setShowCropModal(false)
    setPreview(croppedImageUrl)
    setIsVerifying(true)
    setError(null)

    try {
      console.log("Starting upload process with cropped image")
      
      // Convert base64 to file
      const base64Data = croppedImageUrl.split(',')[1]
      const byteCharacters = atob(base64Data)
      const byteArrays = []
      
      for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
        const slice = byteCharacters.slice(offset, offset + 1024)
        const byteNumbers = new Array(slice.length)
        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        byteArrays.push(byteArray)
      }
      
      const blob = new Blob(byteArrays, { type: 'image/jpeg' })
      const file = new File([blob], "cropped-image.jpg", { type: "image/jpeg" })
      
      console.log("Converted cropped image to file:", {
        size: file.size,
        type: file.type,
        name: file.name
      })

      // Upload file to Supabase
      const uploadUrlResponse = await fetch(`/api/get-upload-url?fileType=${encodeURIComponent(file.type)}`)
      console.log("Got upload URL response:", uploadUrlResponse.status)

      if (!uploadUrlResponse.ok) {
        const errorData = await uploadUrlResponse.json()
        console.error("Failed to get upload URL:", errorData)
        throw new Error(errorData.error || "Failed to get upload URL")
      }

      const { url, filePath } = await uploadUrlResponse.json()
      console.log("Received signed URL and file path:", { filePath })

      // Upload file to Supabase using signed URL
      const uploadResponse = await fetch(url, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      })

      console.log("Upload response status:", uploadResponse.status)

      if (!uploadResponse.ok) {
        console.error("Upload failed:", await uploadResponse.text())
        throw new Error("Failed to upload image. Please try again.")
      }

      console.log("Starting image verification for:", filePath)
      // Verify the image after upload
      const verificationResult = await verifyImage(filePath)
      console.log("Verification result:", verificationResult)

      // Check if the response is a JSON parse error (from route.ts)
      if (!verificationResult.success && verificationResult.error === "Oops, something went wrong. Please try again.") {
        throw new Error("Oops, something went wrong. Please try again.")
      }

      if (!verificationResult.success || !verificationResult.passes) {
        console.error("Verification failed:", verificationResult)
        throw new Error(verificationResult.failureReason || verificationResult.error || "Image verification failed")
      }

      // Update book data with appearance details from the verification result
      updateBookData({ appearance: verificationResult.appearance })
      setUploadedFilePath(filePath)
    } catch (err) {
      console.error("Upload/verification failed:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to process image. Please try again."
      setError(errorMessage)
    } finally {
      setIsUploading(false)
      setIsVerifying(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleNext = async () => {
    if (uploadedFilePath) {
      setIsProcessing(true)
      // Validate required fields
      if (!bookData.age) {
        setError("Age is required")
        setIsProcessing(false)
        return
      }

      try {
        const requestData = {
          name: bookData.name,
          gender: bookData.gender,
          age: bookData.age,
          filePath: uploadedFilePath,
          appearance: bookData.appearance,
        }

        console.log("Sending book data:", requestData)

        const response = await fetch("/api/create-book", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestData),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to create book")
        }

        // Update book data with ID
        updateBookData({ id: data.data.id })
        
        // Now log upload attempt data AFTER we have the book ID and AFTER the upload has been counted
        // The remaining uploads should be one less than what we started with
        try {
          await fetch("/api/log-upload-attempt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionUploadAttempts,
              remainingUploads: bookData.remainingUploads - 1, // Decrement by 1 to reflect the current upload
              visitorId,
              bookId: data.data.id, // Use the book ID we just received
              hitMaxLimit: (bookData.remainingUploads - 1) === 0,
              multipleAttempts: sessionUploadAttempts > 1,
              userAgent: navigator.userAgent,
              timestamp: new Date().toISOString()
            }),
          })
        } catch (logError) {
          // Silent fail for logging - don't interrupt user experience
          console.error("Failed to log upload attempt:", logError)
        }

        try {
          await trackPhotoUploaded({
            bookId: data.data.id,
            filePath: uploadedFilePath,
            sessionUploadAttempts,
            remainingUploads: bookData.remainingUploads - 1,
            visitorId,
            hitMaxLimit: (bookData.remainingUploads - 1) === 0,
            multipleAttempts: sessionUploadAttempts > 1
          })
        } catch (trackError) {
          console.error("Failed to track photo upload:", trackError)
        }

        // Move to next step
        onNext(uploadedFilePath)
      } catch (err) {
        console.error("Failed to create book:", err)
        setError(err instanceof Error ? err.message : "Failed to create book")
      } finally {
        setIsProcessing(false)
      }
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (!file || (!file.type.startsWith('image/') && !file.name.toLowerCase().endsWith('.heic'))) return

    // Track attempt locally but don't send to server yet
    const newAttemptCount = sessionUploadAttempts + 1
    setSessionUploadAttempts(newAttemptCount)
    
    // Log to console only for development
    console.log(`Upload attempt ${newAttemptCount} in session. Remaining uploads: ${bookData.remainingUploads}`)

    try {
      const processedFile = await convertHeicToJpeg(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setTempPreview(reader.result as string)
        setShowCropModal(true)
      }
      reader.readAsDataURL(processedFile)
    } catch (err) {
      console.error('Error processing file:', err)
      setError('Failed to process image. Please try a different format.')
    }
  }

  return (
    <div className="flex flex-col">
      <div className="flex-grow p-4 md:p-6">
        <div className="max-w-2xl mx-auto">
          <div className="px-0">
            <div className="flex items-start">
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="hidden md:flex -ml-16 mr-6 mt-1"
                aria-label="Go back"
              >
                <ArrowLeft className="h-6 w-6" />
              </Button>
              <div className="space-y-2 flex-grow">
                <h2 className="text-4xl font-semibold tracking-tight">
                  Upload a Photo
                </h2>
                <p className="text-muted-foreground">
                  Choose a clear, front-facing photo of {bookData.name}. A school photo usually works best!
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="grid gap-4">
              <Label 
                htmlFor="picture" 
                className={`cursor-pointer relative ${bookData.remainingUploads === 0 ? 'cursor-not-allowed' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {bookData.remainingUploads === 0 && <DisabledOverlay />}
                <div className={`flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-8 text-center transition-colors ${
                  bookData.remainingUploads === 0 
                    ? 'border-muted bg-muted/50' 
                    : isDragging 
                    ? 'border-primary bg-accent border-2' 
                    : 'hover:bg-accent hover:border-primary'
                }`}>
                  {preview ? (
                    <div className="relative aspect-square w-48 overflow-hidden rounded-lg border shadow-sm">
                      <Image src={preview || "/release-placeholder.svg"} alt="Uploaded photo preview" fill className="object-cover" />
                    </div>
                  ) : (
                    <div className="rounded-full bg-muted p-4">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="grid gap-1">
                    <div className="flex items-center justify-center gap-2">
                      <Upload className="h-5 w-5" />
                      <span>{preview ? "Change photo" : "Upload photo"}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">supports JPG, PNG, HEIC</p>
                  </div>
                </div>
                <Input
                  id="picture"
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  className="sr-only"
                  onChange={handleFileChange}
                  disabled={isUploading || bookData.remainingUploads === 0}
                />
              </Label>
            </div>

            {preview && !isVerifying && error ? (
              <Alert className="mt-2 py-2 bg-red-500">
                <AlertDescription className="flex items-center gap-2 justify-center text-white font-bold">
                  <X className="h-4 w-4 text-white" />
                  {error}
                </AlertDescription>
              </Alert>
            ) : preview && !isVerifying && uploadedFilePath ? (
              <Alert className="mt-2 py-2 bg-green-500">
                <AlertDescription className="flex items-center gap-2 justify-center text-white font-bold">
                  <CheckCircle2 className="h-4 w-4 text-white" />
                  This image should work great!
                </AlertDescription>
              </Alert>
            ) : null }

            {bookData.remainingUploads <= 3 && (
              <p className="mt-4 text-sm text-center text-muted-foreground">
                You have {bookData.remainingUploads} free photo {bookData.remainingUploads === 1 ? "upload" : "uploads"} left
              </p>
            )}

            {/* Start Over Link - Only show if user has completed a book before */}
            {bookData.generated_image_urls && bookData.generated_image_urls.length > 0 && (
              <Button
                variant="link"
                size="lg"
                onClick={() => {
                  localStorage.removeItem('bookData')
                  window.location.href = '/create-book'
                }}
                className="w-full font-medium underline mt-2 text-primary"
              >
                Start over with another child
              </Button>
            )}
          </div>

          {/* Desktop Button Row */}
          <div className="mt-6 hidden md:block">
            {error ? (
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
                disabled={isUploading || bookData.remainingUploads === 0}
              >
                Try Another Photo
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                className="w-full md:w-auto"
                size="lg"
                disabled={!uploadedFilePath || bookData.remainingUploads === 0 || isUploading || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Continue'
                )}
              </Button>
            )}
          </div>

          {/* Mobile Sticky Button */}
          <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 z-10 md:hidden">
            {error ? (
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
                disabled={isUploading || bookData.remainingUploads === 0}
              >
                Try Another Photo
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                className="w-full"
                disabled={!uploadedFilePath || bookData.remainingUploads === 0 || isUploading || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Continue'
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
      <VerificationModal open={isVerifying} />
      <ImageCropModal 
        open={showCropModal}
        imageUrl={tempPreview || ''}
        onClose={() => setShowCropModal(false)}
        onCropComplete={handleCropComplete}
      />
    </div>
  )
}

