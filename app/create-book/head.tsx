import Script from 'next/script'
import { getReviewStats } from '@/lib/reviewActions'

export default async function Head() {
  let stats = { averageRating: 5, reviewCount: 0 }
  try {
    stats = await getReviewStats()
  } catch (e) {
    console.error('Failed to fetch review stats for product JSON-LD', e)
  }

  const productJson = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Personalized Children\'s Book',
    image: 'https://www.example.com/release-placeholder.svg',
    description:
      'Create a custom storybook that features your child in a unique adventure.',
    brand: {
      '@type': 'Brand',
      name: 'Storybook Starter',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: stats.averageRating.toFixed(1),
      reviewCount: stats.reviewCount,
    },
  }

  return (
    <Script
      id="ld-product"
      type="application/ld+json"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(productJson) }}
    />
  )
}
