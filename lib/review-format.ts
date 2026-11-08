import { format, parseISO } from 'date-fns';

export function formatReviewDate(reviewDate: string): string {
  return format(parseISO(reviewDate), 'MMM dd, yyyy');
}
