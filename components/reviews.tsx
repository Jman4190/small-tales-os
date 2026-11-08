"use client"

import Image from "next/image"
import { useEffect, useRef } from "react"
import { Star, BadgeCheck } from "lucide-react"
import Masonry from "react-masonry-css"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useReviews } from "@/lib/useReviews"
import { PAGE } from "@/lib/useReviews"
import type { Review } from "@/lib/reviewActions"

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "w-4 h-4 text-yellow-400",
            i < Math.floor(rating)
              ? "fill-yellow-400"
              : i < rating
              ? "fill-yellow-400 opacity-50"
              : "fill-transparent"
          )}
        />
      ))}
    </div>
  )
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {review.mediaUrl && (
          <div className="relative aspect-[3/4] w-full overflow-hidden">
            {review.mediaType === "video" ? (
              <video
                src={review.mediaUrl}
                className="object-contain sm:object-cover w-full h-full cursor-pointer"
                controls
                preload="none"
                poster={review.posterImageUrl}
                aria-label={`Video review from ${review.name}`}
              />
            ) : (
              <Image
                src={review.mediaUrl}
                alt={`Photo from ${review.name}`}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw"
                loading="lazy"
                quality={85}
              />
            )}
          </div>
        )}
        <div className="p-4 sm:p-6">
          <div className="space-y-1">
            <h4 className="text-lg font-semibold font-heading flex flex-wrap items-center gap-1">
              <span>{review.name}</span>
              {review.verified && <BadgeCheck className="w-4 h-4 text-primary" />}
            </h4>
            <div className="flex flex-col gap-0.5">
              <StarRating rating={review.rating} />
              <time className="text-xs text-muted-foreground">{review.date}</time>
            </div>
          </div>
          <p className="mt-2 text-base leading-relaxed font-sans">{review.text}</p>
        </div>
      </CardContent>
    </Card>
  )
}

const bp = { default: 3, 1100: 2, 640: 2 }

export default function Reviews({
  initial,
  loadStyle = 'scroll',
}: {
  initial: Review[]
  loadStyle?: 'scroll' | 'button'
}) {
  const { data, size, setSize, isValidating } = useReviews(initial)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const reviews = data ? data.flat() : []
  const lastPage = data?.[data.length - 1] ?? []
  const hasMore = lastPage.length === PAGE

  useEffect(() => {
    if (loadStyle === 'button') return

    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !isValidating) {
        setSize(size + 1)
      }
    })
    if (loadMoreRef.current) observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [hasMore, isValidating, setSize, size, loadStyle])

  if (!reviews.length) {
    return (
      <section id="latest-reviews" className="py-8 sm:py-16">
        <div className="container px-4 mx-auto text-center">
          <p className="text-muted-foreground">No reviews available yet.</p>
        </div>
      </section>
    )
  }

  return (
    <section id="latest-reviews" className="py-8 sm:py-16">
      <div className="container px-4 mx-auto">
        <div className="text-center mb-6 sm:mb-10">
          <h2 className="text-2xl sm:text-4xl font-heading font-bold text-center mb-8 sm:mb-12">
            Latest Reviews
          </h2>
        </div>

        <Masonry breakpointCols={bp} className="my-masonry-grid" columnClassName="my-masonry-grid_column">
          {reviews.map((review: Review) => (
            <div key={review.id} className="mb-4 sm:mb-6">
              <ReviewCard review={review} />
            </div>
          ))}
        </Masonry>

        {hasMore && (
          <div ref={loadMoreRef} className="mt-12 flex justify-center">
            <Button onClick={() => setSize(size + 1)} disabled={isValidating} variant="outline" size="default" className="w-full sm:w-auto">
              {isValidating ? "Loading..." : "Show More Reviews"}
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
