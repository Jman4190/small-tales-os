"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useRouter } from "next/navigation"

export function CTASection() {
  const router = useRouter()

  return (
    <section className="w-full py-16 bg-muted/50">
      <div className="container px-4 mx-auto">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-heading font-bold mb-6">
            Ready to create your book?
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground mb-8 font-sans">
            Discover how our personalized storybooks can spark your child's imagination and foster a love for reading.
            With AI-powered illustrations and engaging narratives, every book is a unique adventure.
          </p>
          <div className="flex justify-center gap-4">
            <Button
              asChild
              variant="default"
              size="default"
              className="transition-transform duration-150 active:scale-[0.97] hidden md:flex"
              onClick={() => router.push('/create-book')}
            >
              <a>Create Your Custom Book</a>
            </Button>
            <Button
              asChild
              variant="outline"
              size="default"
              className="transition-transform duration-150 active:scale-[0.97] w-auto"
            >
              <Link href="/book-sample">See Sample Book</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

