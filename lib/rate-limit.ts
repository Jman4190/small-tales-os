import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

const WINDOW_MS = 5 * 60 * 1000;
const LIMITS: Record<string, number> = {
  'create-book': 5, 'verify-image': 10, 'get-upload-url': 10, 'course-signup': 3,
  'reminder': 3, 'checkout': 5, 'book-status': 150, 'upload-log': 10, 'character-notification': 3,
};
const store = new Map<string, { count: number; resetAt: number }>();
export interface RateLimitResult { allowed: boolean; retryAfter?: number; unavailable?: boolean }

export async function checkAiBudget(endpoint: 'create-book' | 'verify-image'): Promise<RateLimitResult> {
  if (process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1') return { allowed: true };
  const configured = endpoint === 'create-book' ? process.env.AI_DAILY_CREATE_LIMIT : process.env.AI_DAILY_VERIFY_LIMIT;
  const limit = configured ? Number(configured) : endpoint === 'create-book' ? 100 : 200;
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) return { allowed: false, unavailable: true };
  return consumeSharedLimit(`daily:${endpoint}`, limit, 86400);
}

async function consumeSharedLimit(bucket: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const secret = process.env.INTERNAL_API_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !secret || secret.length < 32) return { allowed: false, unavailable: true };
  try {
    const response = await fetch(`${url}/rest/v1/rpc/consume_rate_limit`, {
      method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(5000),
      headers: { apikey: key, ...(key.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${key}` }), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_key: createHmac('sha256', secret).update(bucket).digest('hex'), p_limit: limit, p_window_seconds: windowSeconds }),
    });
    if (!response.ok) return { allowed: false, unavailable: true };
    const result = await response.json();
    if (typeof result.allowed !== 'boolean') return { allowed: false, unavailable: true };
    return { allowed: result.allowed, ...(result.allowed ? {} : { retryAfter: result.retry_after || windowSeconds }) };
  } catch { return { allowed: false, unavailable: true }; }
}

/** One atomic database counter is shared by every production server. Never fall back on outage. */
export async function checkRateLimit(ip: string, endpoint: string): Promise<RateLimitResult> {
  const limit = LIMITS[endpoint] ?? 10;
  const production = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  if (production) return consumeSharedLimit(`${endpoint}:${ip}`, limit, WINDOW_MS / 1000);
  const now = Date.now();
  if (store.size > 10000) for (const [key, value] of store) if (value.resetAt <= now) store.delete(key);
  const key = `${endpoint}:${ip}`;
  const entry = store.get(key);
  if (!entry || entry.resetAt <= now) { store.set(key, { count: 1, resetAt: now + WINDOW_MS }); return { allowed: true }; }
  if (entry.count >= limit) return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  entry.count++;
  return { allowed: true };
}

export function getClientIp(request: Request): string {
  // Vercel owns x-real-ip. Ignore client-controlled forwarding chains.
  const value = request.headers.get('x-real-ip')?.trim();
  return value && isIP(value) ? value : '127.0.0.1';
}
