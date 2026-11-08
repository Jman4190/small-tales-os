import { stripBucket } from '../lib/stripBucket'

describe('stripBucket', () => {
  it('removes bucket prefix with leading slash', () => {
    expect(stripBucket('/review-media/foo.jpg')).toBe('foo.jpg')
  })

  it('removes bucket prefix without leading slash', () => {
    expect(stripBucket('review-media/bar.png')).toBe('bar.png')
  })

  it('returns null for null or undefined', () => {
    expect(stripBucket(undefined)).toBeNull()
    expect(stripBucket(null)).toBeNull()
  })
})
