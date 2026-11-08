"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { NameStep } from "./CreateBook/NameStep"
import { GenderStep } from "./CreateBook/GenderStep"
import { ImageExampleStep } from "./CreateBook/ImageExampleStep"
import { ImageUploadStep } from "./CreateBook/ImageUploadStep"
import { ProcessingStep } from "./CreateBook/ProcessingStep"
import { CompletionStep } from "./CreateBook/CompletionStep"
import { Header } from "./components/Header"
import type { Step } from "@/types/book"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

type BookData = {
  id?: string
  name: string
  gender: "boy" | "girl"
  age?: number
  remainingUploads: number
  filePath?: string
  imageUrl?: string
  generated_image_urls?: string[]
}

const MAX_UPLOADS = 10

export default function CreateBook() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("name")
  const [hasUploadedPhoto, setHasUploadedPhoto] = useState(false)
  const [restoreState, setRestoreState] = useState<'checking' | 'ready' | 'expired' | 'unavailable'>('checking')
  const [restoreAttempt, setRestoreAttempt] = useState(0)
  const [bookData, setBookData] = useState<BookData>({
    name: "",
    remainingUploads: MAX_UPLOADS,
  } as BookData)

  const steps: Step[] = [
    "name",
    "gender",
    "image-example",
    "upload",
    "processing",
    "completion",
  ]
  const currentStepIndex = steps.indexOf(step)
  const progress = ((currentStepIndex + 1) / steps.length) * 100

  const updateBookData = (data: Partial<BookData>) => {
    setBookData((prev) => ({ ...prev, ...data }))
  }

  const nextStep = () => {
    const currentIndex = steps.indexOf(step)
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1])
    }
  }

  const prevStep = () => {
    const currentIndex = steps.indexOf(step)
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1])
    }
  }

  const handleStepClick = (targetStep: Step) => {
    if (hasUploadedPhoto) return;
    if (targetStep === "name" || targetStep === "gender") {
      const targetIndex = steps.indexOf(targetStep);
      const currentIndex = steps.indexOf(step);
      if (targetIndex < currentIndex) {
        setStep(targetStep);
      }
    }
  };

  // For the first step, we want the back button to send users to landing page "/"
  const headerBack = step === "name" ? () => router.push("/") : prevStep

  // A saved browser snapshot is never proof that this visitor may open a book.
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 10000)
    const restore = async () => {
      try {
        const savedData = localStorage.getItem('bookData')
        if (!savedData) { setRestoreState('ready'); return }
        const parsedData = JSON.parse(savedData)
        if (!parsedData?.imageUrl) { setRestoreState('ready'); return }
        if (typeof parsedData.id !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(parsedData.id)) {
          setRestoreState('expired')
          return
        }
        const response = await fetch(`/api/book-status/${encodeURIComponent(parsedData.id)}`, { cache: 'no-store', signal: controller.signal })
        if (cancelled) return
        if ([400, 401, 403, 404].includes(response.status)) { setRestoreState('expired'); return }
        if (!response.ok) { setRestoreState('unavailable'); return }
        const result = await response.json()
        if (cancelled) return
        const urls = result.data?.generated_image_urls
        if (result.data?.id !== parsedData.id || typeof parsedData.name !== 'string' || !parsedData.name.trim() || parsedData.name.length > 100 ||
            !['boy', 'girl'].includes(parsedData.gender) || !Number.isInteger(parsedData.age) || parsedData.age < 1 || parsedData.age > 18) {
          setRestoreState('expired')
          return
        }
        if (result.data.status !== 'completed' || !Array.isArray(urls) || !urls.length || !urls.every((url: unknown) => typeof url === 'string')) {
          setRestoreState('unavailable')
          return
        }
        setBookData({
          id: parsedData.id,
          name: parsedData.name,
          gender: parsedData.gender,
          age: parsedData.age,
          remainingUploads: Number.isInteger(parsedData.remainingUploads) ? Math.max(0, Math.min(MAX_UPLOADS, parsedData.remainingUploads)) : MAX_UPLOADS,
          imageUrl: urls[0],
          generated_image_urls: urls,
        })
        setStep('completion')
        setHasUploadedPhoto(true)
        setRestoreState('ready')
      } catch {
        if (!cancelled) setRestoreState('unavailable')
      } finally {
        window.clearTimeout(timeout)
      }
    }
    void restore()
    return () => { cancelled = true; window.clearTimeout(timeout); controller.abort() }
  }, [restoreAttempt])

  const handleFreshStart = () => {
    try {
      localStorage.removeItem('bookData')
      localStorage.removeItem('bookStep')
    } catch { /* Storage can be disabled; restarting must still work. */ }
    setBookData({ name: '', remainingUploads: MAX_UPLOADS } as BookData)
    setStep('name')
    setHasUploadedPhoto(false)
    setRestoreState('ready')
  }

  // Clear saved data when starting over
  const handleRestart = () => {
    try { localStorage.removeItem('bookData') } catch { /* Saved state is optional. */ }
    setBookData((prev) => ({
      ...prev,
      id: undefined,
      filePath: undefined,
      imageUrl: undefined,
      generated_image_urls: undefined,
      remainingUploads: prev.remainingUploads - 1,
    }))
    setStep("upload")
    setHasUploadedPhoto(false)
  }

  // Fix for mobile web: reset scroll position on step change
  useEffect(() => {
    if (window.innerWidth < 768) {
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }, [step])

  useEffect(() => {
    if (restoreState !== 'ready') return
    try {
      localStorage.setItem("bookStep", step)
      localStorage.setItem("bookData", JSON.stringify(bookData))
    } catch { /* Continue the active flow when browser storage is unavailable. */ }
  }, [step, bookData, restoreState])

  useEffect(() => {
    if (restoreState !== 'ready') return
    document.cookie = `remainingUploads=${bookData.remainingUploads}; path=/; max-age=86400` // 24 hours
  }, [bookData.remainingUploads, restoreState])

  const handleImageGenerated = (imageUrls: string[]) => {
    setBookData((prev) => ({
      ...prev,
      imageUrl: imageUrls[0], // Keep backward compatibility
      generated_image_urls: imageUrls,
    }))
    setStep("completion")
  }

  return (
    <>
      <Header
        currentStep={step}
        progress={progress}
        onBack={
          step !== "completion" && step !== "processing" ? headerBack : undefined
        }
        onStepClick={handleStepClick}
        hasUploadedPhoto={hasUploadedPhoto}
      />
      <main className="relative">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-2 sm:py-6">
          <div className="flex flex-col">
            {restoreState === 'checking' && <div className="flex items-center justify-center gap-3 py-12" role="status"><LoadingSpinner /><span>Checking your saved preview…</span></div>}
            {(restoreState === 'expired' || restoreState === 'unavailable') && (
              <Alert className="my-8">
                <AlertTitle>{restoreState === 'expired' ? 'Saved preview access has expired' : 'We couldn’t check your saved preview'}</AlertTitle>
                <AlertDescription className="space-y-4">
                  <p>{restoreState === 'expired'
                    ? 'This browser no longer has access to the saved preview. To protect your privacy, please start a new book.'
                    : 'Your saved details are still here. Check your connection and try again, or start a new book.'}</p>
                  <div className="flex flex-wrap gap-3">
                    {restoreState === 'unavailable' && <Button variant="outline" onClick={() => { setRestoreState('checking'); setRestoreAttempt((attempt) => attempt + 1) }}>Try again</Button>}
                    <Button onClick={handleFreshStart}>Start a new book</Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}
            {restoreState === 'ready' && step === "name" && (
              <NameStep
                name={bookData.name}
                onNext={(name) => {
                  updateBookData({ name })
                  nextStep()
                }}
                onBack={headerBack}
              />
            )}

            {restoreState === 'ready' && step === "gender" && (
              <GenderStep
                gender={bookData.gender}
                age={bookData.age}
                onBack={prevStep}
                onNext={({ gender, age }) => {
                  updateBookData({ gender, age })
                  nextStep()
                }}
                bookData={bookData}
              />
            )}

            {restoreState === 'ready' && step === "image-example" && (
              <ImageExampleStep onBack={prevStep} onNext={nextStep} />
            )}

            {restoreState === 'ready' && step === "upload" && (
              <ImageUploadStep
                bookData={bookData}
                onBack={prevStep}
                onNext={(filePath) => {
                  updateBookData({ filePath })
                  setHasUploadedPhoto(true)
                  nextStep()
                }}
                updateBookData={updateBookData}
              />
            )}

            {restoreState === 'ready' && step === "processing" && (
              <ProcessingStep
                bookData={bookData}
                onComplete={handleImageGenerated}
              />
            )}

            {restoreState === 'ready' && step === "completion" && (
              <CompletionStep bookData={bookData} onRestart={handleRestart} />
            )}
          </div>
        </div>
      </main>
    </>
  )
}

