import 'server-only';
import { NextResponse } from 'next/server';
import { checkRateLimit, checkAiBudget, getClientIp } from '@/lib/rate-limit';

export async function guardAiBudget(endpoint: 'create-book' | 'verify-image') {
  const result = await checkAiBudget(endpoint);
  if (result.unavailable) return NextResponse.json({ error: 'Temporarily unavailable. Please try again.' }, { status: 503 });
  if (!result.allowed) return NextResponse.json({ error: 'We are at preview capacity. Please try again later.' }, { status: 429, headers: { 'Retry-After': String(result.retryAfter || 86400) } });
  return null;
}

export async function guardPublicRequest(request: Request, endpoint: string) {
  const origin = request.headers.get('origin');
  const expected = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  if (request.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== new URL(expected).origin && origin !== new URL(request.url).origin)) {
    return NextResponse.json({ error: 'Request not allowed' }, { status: 403 });
  }
  const result = await checkRateLimit(getClientIp(request), endpoint);
  if (result.unavailable) return NextResponse.json({ error: 'Temporarily unavailable. Please try again.' }, { status: 503 });
  if (!result.allowed) return NextResponse.json({ error: 'Too many requests. Please try again later.' }, {
    status: 429, headers: { 'Retry-After': String(result.retryAfter || 300) },
  });
  return null;
}
