// /app/page.tsx
import { Header } from '@/components/header'
import type { Metadata } from 'next'
import dynamic from 'next/dynamic'

import { PostCheckoutBanner } from '@/components/post-checkout-banner'
import { Hero } from '@/components/hero'
import { HowItWorks } from '@/components/how-it-works'
import { Testimonials } from '@/components/testimonials'
import { ValueProps } from '@/components/value-props'
import { Faq, FAQS } from '@/components/faq'
import { ReminderCta } from '@/components/reminder-cta'
import { Footer } from '@/components/footer'
import { StickyCTAButton } from '@/components/sticky-cta-button'
import { getReviews } from '@/lib/reviewActions'
import type { Review } from '@/lib/reviewActions'
import Script from 'next/script'

// Lazy-load heavy below-fold components to reduce initial JS bundle
const Features = dynamic(() => import('@/components/features').then(m => ({ default: m.Features })))
const PhotoExamples = dynamic(() => import('@/components/photo-examples').then(m => ({ default: m.PhotoExamples })))
const Reviews = dynamic(() => import('@/components/reviews'))

export const metadata: Metadata = {
  alternates: {
    canonical: '/',
  },
}

export default async function Home() {
  let initial: Review[] = []
  try {
    initial = await getReviews()
  } catch (error) {
    console.error("Failed to fetch reviews for Home page:", error)
  }

  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Storybook Starter',
    url: 'https://www.example.com',
    logo: 'https://www.example.com/release-placeholder.svg',
    sameAs: [
      'https://example.com/social/instagram',
      'https://example.com/social/tiktok',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      email: 'support@example.com',
    },
  }

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Storybook Starter Personalized Book',
    image: 'https://www.example.com/release-placeholder.svg',
    description: 'Create magical personalized storybooks for your child. Upload one photo and watch your little one become the star of their own adventure.',
    brand: {
      '@type': 'Brand',
      name: 'Storybook Starter',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      reviewCount: '500',
      bestRating: '5',
      worstRating: '1',
    },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'USD',
      price: '39.99',
      priceValidUntil: '2026-12-31',
      availability: 'https://schema.org/InStock',
      url: 'https://www.example.com/create-book',
    },
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://www.example.com/',
      },
    ],
  }

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }

  return (
    <>
      <Script
        id="ld-organization"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <Script
        id="ld-product"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <Script
        id="ld-breadcrumb"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Script
        id="ld-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Header />
      <PostCheckoutBanner />
      <main id="main-content" className="w-full overflow-x-hidden">
        <Hero />
        <HowItWorks />
        <Features />
        <Testimonials />
        <ValueProps />
        <PhotoExamples />
        <Reviews initial={initial} loadStyle="button" />
        <Faq />
        <ReminderCta />
        <Footer />
        <StickyCTAButton />
      </main>
    </>
  )
}

