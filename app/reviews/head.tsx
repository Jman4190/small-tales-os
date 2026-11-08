import Script from 'next/script'
import { getReviewStats } from '@/lib/reviewActions'

export default async function Head() {
  let stats = { averageRating: 5, reviewCount: 0 }
  try {
    stats = await getReviewStats()
  } catch (e) {
    console.error('Failed to fetch review stats for reviews JSON-LD', e)
  }

  const reviewJson = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Storybook Starter Personalized Book',
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: stats.averageRating.toFixed(1),
      reviewCount: stats.reviewCount,
    },
  }

  return (
    <Script
      id="ld-reviews"
      type="application/ld+json"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewJson) }}
    />
  )
}
