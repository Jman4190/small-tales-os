"use server";

import { createClient } from "@/utils/supabase/server";
import { stripBucket } from "@/lib/stripBucket";
import { REVIEW_PAGE_SIZE } from "@/lib/review-constants";
import { formatReviewDate } from "@/lib/review-format";

export interface Review {
  id: string;
  name: string;
  date: string;
  rating: number;
  text: string;
  verified?: boolean;
  mediaUrl?: string;
  posterImageUrl?: string;
  mediaType?: "image" | "video";
}

interface ReviewRow {
  id: string;
  name: string;
  rating: number;
  text: string;
  verified: boolean;
  media_path: string | null;
  media_type: "image" | "video" | null;
  poster_image_path: string | null;
  review_date: string;
}

export async function getReviews(limit = REVIEW_PAGE_SIZE): Promise<Review[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select(
      "id,name,rating,text,verified,media_path,media_type,poster_image_path,review_date"
    )
    .order("review_date", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`reviews:select – ${error.message}`);

  return (data ?? []).map((row: ReviewRow) => {
    const media = stripBucket(row.media_path);
    const poster = stripBucket(row.poster_image_path);

    return {
      id: row.id,
      name: row.name,
      date: formatReviewDate(row.review_date),
      rating: row.rating,
      text: row.text,
      verified: row.verified,
      mediaUrl: media
        ? supabase.storage.from("review-media").getPublicUrl(media).data
            .publicUrl
        : undefined,
      posterImageUrl: poster
        ? supabase.storage.from("review-media").getPublicUrl(poster).data
            .publicUrl
        : undefined,
      mediaType: row.media_type ?? undefined,
    };
  });
}

export interface ReviewStats {
  averageRating: number;
  reviewCount: number;
}

export async function getReviewStats(): Promise<ReviewStats> {
  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from('reviews')
    .select('rating', { count: 'exact' })
    .limit(1000);

  if (error) throw new Error(`reviews:stats – ${error.message}`);

  const ratings = (data ?? []).map((r: { rating: number }) => r.rating);
  const total = ratings.reduce((sum, r) => sum + r, 0);
  return {
    averageRating: ratings.length ? total / ratings.length : 0,
    reviewCount: count ?? ratings.length,
  };
}
