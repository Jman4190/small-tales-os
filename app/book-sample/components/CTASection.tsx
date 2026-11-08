"use client"

import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export function CTASection() {
  const router = useRouter()

  return (
    <section id="cta-section" className="w-full py-16 bg-muted/50">
      <div className="container px-4 mx-auto">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-heading font-bold mb-6">
            Want to see the full story?
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground mb-8 font-sans">
            This is just a sneak peek of our magical storybook. Create your own personalized adventure to discover how your child's story unfolds across all 30 beautifully illustrated pages.
          </p>
          <Button 
            onClick={() => router.push("/create-book")}
            variant="default"
            size="default"
            className="mx-auto"
          >
            Create Your Custom Book
          </Button>
        </div>
      </div>
    </section>
  )
}