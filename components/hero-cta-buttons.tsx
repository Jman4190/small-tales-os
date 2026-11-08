// /components/hero-cta-buttons.tsx
"use client"

import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { useRouter } from "next/navigation"

export function HeroCTAButtons() {
  const router = useRouter()
  
  return (
    <div className="flex flex-col sm:flex-row gap-4 pt-2">
      <Button 
        size="default"
        onClick={() => router.push('/create-book')}
        className="w-full md:w-auto"
      >
        Create Your Book
        <ArrowRight className="ml-2 h-5 w-5 transition-transform" />
      </Button>
      <Button
        asChild
        variant="outline"
        size="default"
        className="transition-transform duration-150 active:scale-[0.97] w-full sm:w-auto"
      >
        <a href="/book-sample">Read a Sample Book</a>
      </Button>
    </div>
  )
}