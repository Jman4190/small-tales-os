import { checkRateLimit, checkAiBudget, getClientIp } from '../lib/rate-limit';

// Each test file gets a fresh module because Jest re-imports between describes
// but the in-memory Map persists within a file. Use unique IPs per test to isolate.

describe('checkRateLimit', () => {
  it('allows the first request from an IP', async () => {
    const result = await checkRateLimit('1.1.1.1', 'create-book');
    expect(result.allowed).toBe(true);
  });

  it('allows up to the per-endpoint limit', async () => {
    const ip = '2.2.2.2';
    // create-book limit is 5
    for (let i = 0; i < 5; i++) {
      expect((await checkRateLimit(ip, 'create-book')).allowed).toBe(true);
    }
  });

  it('blocks the request that exceeds the limit', async () => {
    const ip = '3.3.3.3';
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(ip, 'create-book');
    }
    const result = await checkRateLimit(ip, 'create-book');
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('uses separate buckets per endpoint for the same IP', async () => {
    const ip = '4.4.4.4';
    // exhaust create-book bucket
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(ip, 'create-book');
    }
    expect((await checkRateLimit(ip, 'create-book')).allowed).toBe(false);
    // verify-image bucket is independent
    expect((await checkRateLimit(ip, 'verify-image')).allowed).toBe(true);
  });

  it('uses separate buckets per IP for the same endpoint', async () => {
    const ipA = '5.5.5.5';
    const ipB = '6.6.6.6';
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(ipA, 'create-book');
    }
    expect((await checkRateLimit(ipA, 'create-book')).allowed).toBe(false);
    expect((await checkRateLimit(ipB, 'create-book')).allowed).toBe(true);
  });

  it('verify-image allows up to 10 requests', async () => {
    const ip = '7.7.7.7';
    for (let i = 0; i < 10; i++) {
      expect((await checkRateLimit(ip, 'verify-image')).allowed).toBe(true);
    }
    expect((await checkRateLimit(ip, 'verify-image')).allowed).toBe(false);
  });
});

describe('getClientIp', () => {
  it('uses x-real-ip when present', async () => {
    const req = new Request('http://localhost/api/test', {
      headers: { 'x-real-ip': '10.0.0.1' },
    });
    expect(getClientIp(req)).toBe('10.0.0.1');
  });

  it('falls back to 127.0.0.1 when no header present', async () => {
    const req = new Request('http://localhost/api/test');
    expect(getClientIp(req)).toBe('127.0.0.1');
  });

  it('ignores x-forwarded-for for security decisions', async () => {
    const req = new Request('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '192.168.1.1' },
    });
    expect(getClientIp(req)).toBe('127.0.0.1');
  });
});

describe('shared production limiter', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalFetch = global.fetch;
  beforeEach(() => { Object.assign(process.env, { NODE_ENV: 'production' }); });
  afterEach(() => { Object.assign(process.env, { NODE_ENV: originalEnv }); global.fetch = originalFetch; });
  it('fails closed on network and database errors', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network'));
    expect(await checkRateLimit('1.2.3.4', 'create-book')).toMatchObject({ allowed: false, unavailable: true });
    global.fetch = jest.fn().mockResolvedValue(new Response('{}', { status: 500 }));
    expect(await checkRateLimit('1.2.3.4', 'create-book')).toMatchObject({ allowed: false, unavailable: true });
  });
  it('bounds paid usage across all IPs with a shared daily counter', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(JSON.stringify({ allowed: true })));
    global.fetch = fetchMock;
    expect(await checkAiBudget('create-book')).toEqual({ allowed: true });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.p_limit).toBe(100);
    expect(body.p_window_seconds).toBe(86400);
  });
  it('uses the shared counter and sends a hash instead of the visitor IP', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(JSON.stringify({ allowed: false, retry_after: 60 })));
    global.fetch = fetchMock;
    expect(await checkRateLimit('1.2.3.4', 'create-book')).toEqual({ allowed: false, retryAfter: 60 });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.p_key).toMatch(/^[a-f0-9]{64}$/);
    expect(fetchMock.mock.calls[0][1].body).not.toContain('1.2.3.4');
    expect(body.p_limit).toBe(5);
  });
});
