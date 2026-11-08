import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { NextResponse } from 'next/server';

type Appearance = { skinTone: string; hair: string; eyeColor: string };
type Grant = { kind: 'upload' | 'verified-upload' | 'book'; resource: string; exp: number; appearance?: Appearance };
const TTL_SECONDS = 30 * 24 * 60 * 60;

function signingKey() {
  const key = process.env.INTERNAL_API_SECRET;
  if (!key || key.length < 32) throw new Error('INTERNAL_API_SECRET must contain at least 32 characters');
  return key;
}

export function accessCookieName(kind: 'upload' | 'book', resource: string) {
  return `st-${kind}-${createHash('sha256').update(resource).digest('hex').slice(0, 24)}`;
}

export function signGrant(grant: Grant): string {
  const payload = Buffer.from(JSON.stringify(grant)).toString('base64url');
  return `${payload}.${createHmac('sha256', signingKey()).update(payload).digest('base64url')}`;
}

export function readGrant(request: Request, kind: 'upload' | 'book', resource: string): Grant | null {
  const cookieName = accessCookieName(kind, resource);
  const value = (request.headers.get('cookie') || '').split(';').map(v => v.trim())
    .find(v => v.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  if (!value || value.length > 4096) return null;
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra) return null;
  const expected = createHmac('sha256', signingKey()).update(payload).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const grant = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Grant;
    const matchingKind = kind === 'upload' ? ['upload', 'verified-upload'].includes(grant.kind) : grant.kind === 'book';
    return matchingKind && grant.resource === resource && Number.isFinite(grant.exp) && grant.exp > Date.now() ? grant : null;
  } catch { return null; }
}

export function grantAccess(response: NextResponse, kind: Grant['kind'], resource: string, appearance?: Appearance) {
  const maxAge = kind === 'book' ? TTL_SECONDS : 3600;
  const signed = signGrant({
    kind, resource, exp: Date.now() + maxAge * 1000, ...(appearance ? { appearance } : {}),
  });
  if (Buffer.byteLength(signed) > 3500) throw new Error('Access cookie exceeds supported size');
  response.cookies.set(accessCookieName(kind === 'book' ? 'book' : 'upload', resource), signed,
    { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export function hasBookAccess(request: Request, bookId: string) { return !!readGrant(request, 'book', bookId); }

export function isUploadPath(path: unknown): path is string {
  return typeof path === 'string' && path.length <= 200 && /^uploads\/[a-zA-Z0-9_-]+\.(jpe?g|png|webp|heic|heif)$/.test(path);
}

export function verifiedAppearance(value: unknown): Appearance | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const appearance = value as Record<string, unknown>;
  const result: Record<string, string> = {};
  for (const key of ['skinTone', 'hair', 'eyeColor']) {
    const description = appearance[key];
    if (typeof description !== 'string' || !description.trim() || Buffer.byteLength(description.trim()) > 200) return null;
    result[key] = description.trim();
  }
  return result as Appearance;
}
