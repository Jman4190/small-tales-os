import { getReviews } from '../lib/reviewActions'
import { REVIEW_PAGE_SIZE } from '../lib/review-constants'

jest.mock('../utils/supabase/server', () => {
  return {
    createClient: jest.fn(() => ({
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({
        data: [
          {
            id: '1',
            name: 'Alice',
            rating: 5,
            text: 'Great',
            verified: true,
            media_path: 'review-media/a.jpg',
            media_type: 'image',
            poster_image_path: null,
            review_date: '2024-01-01',
          },
        ],
        error: null,
      }),
      storage: {
        from: () => ({ getPublicUrl: () => ({ data: { publicUrl: 'url' } }) }),
      },
    })),
  }
})

describe('getReviews', () => {
  it('maps rows to Review objects', async () => {
    const reviews = await getReviews(1)
    expect(reviews).toEqual([
      {
        id: '1',
        name: 'Alice',
        date: 'Jan 01, 2024',
        rating: 5,
        text: 'Great',
        verified: true,
        mediaUrl: 'url',
        posterImageUrl: undefined,
        mediaType: 'image',
      },
    ])
  })

  it('uses PAGE as default limit', async () => {
    await getReviews()
    // @ts-ignore — use the last createClient call (this test's call, not the first test's)
    const calls = require('../utils/supabase/server').createClient.mock.results;
    const client = calls[calls.length - 1].value;
    expect(client.limit).toHaveBeenCalledWith(REVIEW_PAGE_SIZE)
  })
})
