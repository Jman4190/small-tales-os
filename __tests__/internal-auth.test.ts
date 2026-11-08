import { verifyInternalSecret } from '../lib/internal-auth';

const VALID_SECRET = 'test-internal-secret-32-chars-long!!';

function makeRequest(secret?: string): Request {
  const headers: Record<string, string> = {};
  if (secret !== undefined) {
    headers['x-internal-secret'] = secret;
  }
  return new Request('http://localhost/api/gelato/create-order', {
    method: 'POST',
    headers,
  });
}

describe('verifyInternalSecret', () => {
  it('returns true when the correct secret is provided', () => {
    const req = makeRequest(VALID_SECRET);
    expect(verifyInternalSecret(req)).toBe(true);
  });

  it('returns false when the secret is wrong', () => {
    const req = makeRequest('wrong-secret');
    expect(verifyInternalSecret(req)).toBe(false);
  });

  it('returns false when the header is absent', () => {
    const req = makeRequest();
    expect(verifyInternalSecret(req)).toBe(false);
  });

  it('returns false when the header is an empty string', () => {
    const req = makeRequest('');
    expect(verifyInternalSecret(req)).toBe(false);
  });

  it('is case-sensitive', () => {
    const req = makeRequest(VALID_SECRET.toUpperCase());
    expect(verifyInternalSecret(req)).toBe(false);
  });
});
