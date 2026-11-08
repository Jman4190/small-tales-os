// app/create-book/components/ButtonRow.tsx
"use client"

import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"

interface ButtonRowProps {
  onBack?: () => void
  backLabel?: string
  onNext: () => void
  nextLabel?: string
  nextDisabled?: boolean
  loading?: boolean
  size?: "default" | "sm" | "lg"
}

export function ButtonRow({
  onBack,
  backLabel = "Back",
  onNext,
  nextLabel = "Continue",
  nextDisabled = false,
  loading = false,
  size = "default",
}: ButtonRowProps) {
  const [isSticky, setIsSticky] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

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
      const headerHeight = 68 // Height of the header

      setIsSticky(contentHeight > viewportHeight - headerHeight)
    }

    checkScroll()
    window.addEventListener("resize", checkScroll)
    window.addEventListener("scroll", checkScroll)
    return () => {
      window.removeEventListener("resize", checkScroll)
      window.removeEventListener("scroll", checkScroll)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={`w-full ${isSticky ? "fixed bottom-0 left-0 right-0 bg-white border-t p-4 z-10" : ""}`}
    >
      <div className="flex gap-4 max-w-2xl mx-auto">
        {onBack && (
          <Button
            onClick={onBack}
            variant="outline"
            size="default"
            className="hidden md:inline-flex"
          >
            {backLabel}
          </Button>
        )}
        <Button
          onClick={onNext}
          disabled={nextDisabled}
          size={size}
          className="w-full md:w-auto"
        >
          {loading ? (
            <>
              <span className="animate-spin mr-2">⏳</span>
              Processing...
            </>
          ) : (
            nextLabel
          )}
        </Button>
      </div>
    </div>
  )
}

