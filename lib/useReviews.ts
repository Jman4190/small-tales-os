import useSWRInfinite from 'swr/infinite'
import { createClient } from '@/utils/supabase/client'
import { stripBucket } from '@/lib/stripBucket'
import type { Review } from '@/lib/reviewActions'
import { formatReviewDate } from '@/lib/review-format'
import { REVIEW_PAGE_SIZE } from '@/lib/review-constants'

export const PAGE = REVIEW_PAGE_SIZE
const supabase = createClient()

export function useReviews(initial?: any[]) {
  const { data, ...rest } = useSWRInfinite(
    (index: number, prev: any) => (prev && !prev.length ? null : `reviews-${index}`),
    async (key: string) => {
      const page = Number(key.split('-')[1])
      const { data } = await supabase
        .from('reviews')
        .select(
          'id,name,rating,text,verified,media_path,media_type,poster_image_path,review_date'
        )
        .order('review_date', { ascending: false })
        .range(page * PAGE, page * PAGE + PAGE - 1)

      return (data ?? []).map((row: any) => {
        const media = stripBucket(row.media_path)
        const poster = stripBucket(row.poster_image_path)

        return {
          id: row.id,
          name: row.name,
          date: formatReviewDate(row.review_date),
          rating: row.rating,
          text: row.text,
          verified: row.verified,
          mediaUrl: media
            ? supabase.storage.from('review-media').getPublicUrl(media).data
                .publicUrl
            : undefined,
          posterImageUrl: poster
            ? supabase.storage.from('review-media').getPublicUrl(poster).data
                .publicUrl
            : undefined,
          mediaType: row.media_type ?? undefined,
        }
      })
    },
    {
      revalidateFirstPage: false,
      fallbackData: initial !== undefined ? [initial] : undefined,
    }
  )

  return { data: data as Review[][] | undefined, ...rest }
}
