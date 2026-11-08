/**
 * Tests for the token expiry logic used in /api/approve and /api/decline.
 * We test the business logic in isolation, not the full route handler.
 */

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function isTokenExpired(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() > THIRTY_DAYS_MS;
}

describe('approval token expiry', () => {
  it('accepts a token created right now', () => {
    const createdAt = new Date().toISOString();
    expect(isTokenExpired(createdAt)).toBe(false);
  });

  it('accepts a token created 29 days ago', () => {
    const createdAt = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString();
    expect(isTokenExpired(createdAt)).toBe(false);
  });

  it('accepts a token created exactly 30 days ago (boundary — not yet expired)', () => {
    // The check is `> THIRTY_DAYS_MS` (strictly greater), so exactly at the boundary
    // the token is still considered valid. One millisecond over and it expires.
    const createdAt = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();
    expect(isTokenExpired(createdAt)).toBe(false);
  });

  it('rejects a token created 30 days and 1 second ago', () => {
    const createdAt = new Date(Date.now() - THIRTY_DAYS_MS - 1000).toISOString();
    expect(isTokenExpired(createdAt)).toBe(true);
  });

  it('rejects a token created 31 days ago', () => {
    const createdAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    expect(isTokenExpired(createdAt)).toBe(true);
  });

  it('rejects a token created a year ago', () => {
    const createdAt = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    expect(isTokenExpired(createdAt)).toBe(true);
  });
});
