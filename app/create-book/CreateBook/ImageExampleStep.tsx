"use client"

import Image from "next/image"
import { CheckCircle2, X, ChevronLeft, ArrowLeft } from "lucide-react"
import { ButtonRow } from "../components/ButtonRow"
import { Button } from "@/components/ui/button"

interface ImageExampleProps {
  onNext: () => void
  onBack: () => void
}

interface ExampleImage {
  src: string
  alt: string
  isGood: boolean
  label?: string
}

export function ImageExampleStep({ onNext, onBack }: ImageExampleProps) {
  const exampleImages: ExampleImage[] = [
    {
      src: "/release-placeholder.svg",
      alt: "Good example of a photo - well lit, face centered",
      isGood: true,
      label: "Well-lit, clear composition",
    },
    {
      src: "/release-placeholder.svg",
      alt: "Bad example of a photo - poor quality and blurry",
      isGood: false,
      label: "Avoid blurry or low quality",
    },
    {
      src: "/release-placeholder.svg",
      alt: "Good example of a photo - good composition",
      isGood: true,
      label: "Good composition",
    },
    {
      src: "/release-placeholder.svg",
      alt: "Bad example of a photo - poor lighting and quality",
      isGood: false,
      label: "Poor lighting and quality",
    },
  ]

  const tips = [
    "Use a high-quality, well-lit image",
    "Be face-centered and forward-facing",
    "Include a simple background with minimal distractions",
    "Present only your character in the photo"
  ]

  return (
    <div className="flex flex-col">
      <div className="flex-grow p-4 md:p-6 pb-[calc(4rem+1px)] md:pb-6">
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
                <h2 className="text-4xl font-semibold tracking-tight">Photo Guidelines</h2>
                <p className="text-muted-foreground">
                  Follow these tips to get the best results for your character illustration.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            {/* Tips */}
            <div className="space-y-3 bg-muted/50 rounded-lg p-4">
              <h3 className="font-semibold">For Best Results:</h3>
              <ul className="space-y-2">
                {tips.map((tip, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-6">
            {/* Example Images */}
            <div className="w-full">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-2">
                {exampleImages.map((image, index) => (
                  <div key={index} className="relative w-full pb-4">
                    <div
                      className={`relative aspect-[3/4] rounded-lg overflow-hidden border-4 ${
                        image.isGood ? "border-green-500" : "border-red-500"
                      }`}
                    >
                      <Image src={image.src || "/release-placeholder.svg"} alt={image.alt} fill className="object-cover" />
                    </div>
                    <div
                      className={`absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full p-1.5 shadow-sm ${
                        image.isGood ? "bg-green-500" : "bg-red-500"
                      }`}
                    >
                      {image.isGood ? (
                        <CheckCircle2 className="w-5 h-5 text-white" />
                      ) : (
                        <X className="w-5 h-5 text-white" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-6">
            {/* Desktop */}
            <div className="hidden md:block">
              <Button
                onClick={onNext}
                className="w-full md:w-auto"
                size="lg"
              >
                Continue
              </Button>
            </div>

            {/* Mobile - Keep ButtonRow with back button */}
            <div className="md:hidden">
              <ButtonRow onBack={onBack} onNext={onNext} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

