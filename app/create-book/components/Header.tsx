"use client"

import { Pacifico } from "next/font/google"
import { Progress } from "@/components/ui/progress"
import type { Step } from "@/types/book"
import { cn } from "@/lib/utils"
import Link from "next/link"
import Image from "next/image"
import { ChevronLeft, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ElementType } from "react"

const pacifico = Pacifico({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
})

interface HeaderProps {
  currentStep: Step
  progress: number
  onBack?: () => void
  onStepClick?: (step: Step) => void
  hasUploadedPhoto?: boolean
}

const steps: { key: Step; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "gender", label: "Gender" },
  { key: "image-example", label: "Tips" },
  { key: "upload", label: "Photo" },
  { key: "completion", label: "Preview" },
]

export function Header({ currentStep, progress, onBack, onStepClick, hasUploadedPhoto = false }: HeaderProps) {
  const showBackButton = onBack !== undefined;

  const isStepClickable = (step: Step) => {
    // Only allow clicking on name and gender steps before photo upload
    if (!onStepClick) return false;
    if (hasUploadedPhoto) return false;
    if (step === "name" || step === "gender") {
      const currentStepIndex = steps.findIndex(s => s.key === currentStep);
      const stepIndex = steps.findIndex(s => s.key === step);
      // Only allow clicking on previous steps
      return stepIndex < currentStepIndex;
    }
    return false;
  };

  const handleStepClick = (step: Step) => {
    if (onStepClick && isStepClickable(step)) {
      onStepClick(step);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center md:px-6">
        <div className="flex w-full md:w-auto items-center">
          {/* Back Button - Mobile Only */}
          {showBackButton && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="md:hidden absolute left-2"
              aria-label="Go back"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
          )}

          {/* Logo with Link - always centered on mobile */}
          <Link href="/" className="w-full flex justify-center">
            <Image 
              src="/release-placeholder.svg" 
              alt="Storybook Starter" 
              width={120}
              height={32}
              className="h-8 w-auto"
              priority
            />
          </Link>

          {/* Steps - Desktop Only */}
          <nav className="hidden md:block ml-8">
            <ol className="flex items-center gap-2">
              {steps.map((step, index) => {
                const clickable = isStepClickable(step.key);
                const StepComponent: ElementType = clickable ? 'button' : 'div';
                
                return (
                  <li key={step.key} className="flex items-center">
                    <StepComponent
                      onClick={clickable ? () => handleStepClick(step.key) : undefined}
                      className={cn(
                        "px-3 py-1 text-sm",
                        currentStep === step.key ? "font-bold text-foreground" : "text-muted-foreground",
                        clickable && "cursor-pointer hover:text-primary transition-colors",
                        !clickable && "cursor-default"
                      )}
                    >
                      {step.label}
                    </StepComponent>
                    {index < steps.length - 1 && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="ml-2 text-muted-foreground/40"
                      >
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>
      </div>
      <Progress value={progress} className="h-1" />
    </header>
  )
}
