// /components/hero.tsx
import { StaticHero } from "./static-hero"
import { Suspense, lazy } from "react"

// Lazy load the enhanced hero with carousel functionality
const EnhancedHero = lazy(() => import("./enhanced-hero").then(module => ({ default: module.EnhancedHero })))

export function Hero() {
  return (
    <Suspense fallback={<StaticHero />}>
      <EnhancedHero />
    </Suspense>
  )
}

