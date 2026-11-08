// /components/static-hero.tsx
import Image from "next/image"
import { BookOpen, BookCopy, ShieldCheck } from "lucide-react"
import { HeroCTAButtons } from "./hero-cta-buttons"

export function StaticHero() {
  return (
    <section id="hero-section" className="py-8 sm:py-16">
      <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div className="order-1 lg:order-1 w-full max-w-2xl mx-auto lg:max-w-none">
            <div className="w-full space-y-2">
              <div className="relative aspect-[4/3] w-full max-w-xl mx-auto overflow-hidden rounded-lg">
                <Image
                  src="/release-placeholder.svg"
                  alt="Collection of beautifully crafted personalized children's books"
                  fill
                  className="object-cover"
                  priority
                  fetchPriority="high"
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  quality={70}
                />
              </div>
            </div>
          </div>
          <div className="order-2 lg:order-2 flex flex-col justify-center space-y-4 sm:space-y-6">
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-4xl lg:text-5xl font-heading font-bold tracking-tight leading-[1.2]">
                A Personalized Book
                <span className="block mt-2">
                  for <span className="text-[#5075FE]">Your Little Ones</span>
                </span>
              </h1>
              <p className="text-lg sm:text-lg text-muted-foreground max-w-2xl font-sans">
                Transform a picture of your child into a custom character illustration, and bring their stories to life with Storybook Starter.
              </p>
            </div>

            <div>
              <p className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl lg:text-3xl text-muted-foreground line-through">$60</span>
                <span className="text-2xl sm:text-3xl lg:text-4xl font-bold">$39.99</span>
              </p>
            </div>

            <div className="space-y-4 sm:space-y-5">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-heading font-semibold">30 pages of adventure</h3>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                  <BookCopy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-heading font-semibold">Premium hardcover quality</h3>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-heading font-semibold">100% refund policy</h3>
                </div>
              </div>
            </div>

            <HeroCTAButtons />
          </div>
        </div>
      </div>
    </section>
  )
}