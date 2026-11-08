import { getReviews } from '@/lib/reviewActions'
import Reviews from '@/components/reviews'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  alternates: {
    canonical: '/reviews',
  },
}

export default async function ReviewsPage() {
  const initial = await getReviews(20)

  return (
    <>
      <Header />
      <main className="w-full overflow-x-hidden">
        <Reviews initial={initial} />
      </main>
      <Footer />
    </>
  )
}
