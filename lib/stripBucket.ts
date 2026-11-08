export const stripBucket = (p?: string | null) =>
  p ? p.replace(/^\/?review-media\//, '') : null;
