import { ImageGrid } from "./components/ImageGrid"
import { CTASection } from "./components/CTASection"
import { HeroSection } from "./components/HeroSection"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { StickyCTAButton } from "@/components/sticky-cta-button"
import type { Metadata } from 'next'

export const metadata: Metadata = {
  alternates: {
    canonical: '/photo-examples',
  },
}

export default function PhotoExamplesPage() {
  return (
    <>
      <Header />
      <main className="w-full overflow-x-hidden">
        <HeroSection />
        <ImageGrid />
        <CTASection />
        <Footer />
        <StickyCTAButton />
      </main>
    </>
  )
}

