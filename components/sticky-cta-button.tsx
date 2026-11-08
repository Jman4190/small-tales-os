// /components/sticky-cta-button.tsx
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

interface StickyCTAButtonProps {
  hideOnElementId?: string // Optional ID to hide button when scrolled to
}

export function StickyCTAButton({ hideOnElementId }: StickyCTAButtonProps) {
  const router = useRouter()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      if (hideOnElementId) {
        const element = document.querySelector(`#${hideOnElementId}`)
        if (element) {
          const elementRect = element.getBoundingClientRect()
          setIsVisible(elementRect.top > window.innerHeight)
        }
      } else {
        const heroSection = document.querySelector("#hero-section")
        if (heroSection) {
          const heroBottom = heroSection.getBoundingClientRect().bottom
          setIsVisible(heroBottom <= 0)
        }
      }
    }

    handleScroll() // Check initial position
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [hideOnElementId])

  if (!isVisible) return null

  return (
    <div className="fixed bottom-0 inset-x-0 w-screen bg-background border-t border-border md:hidden px-4 py-4">
      <Button
        size="default" // Enforces h-10 px-6 py-2 text-base from our tokens
        className="w-full"  // styling now derived from central tokens
        onClick={() => router.push('/create-book')}
      >
        Try a Free Book Preview
      </Button>
    </div>
  )
}

