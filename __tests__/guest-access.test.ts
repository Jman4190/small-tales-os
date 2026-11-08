import { NextResponse } from 'next/server';
import { accessCookieName, grantAccess, hasBookAccess, isUploadPath, readGrant, signGrant, verifiedAppearance } from '@/lib/guest-access';

const resource = 'uploads/anonymous_123-abc.png';
function requestCookie(name: string, value: string) {
  return new Request('https://example.com/api', { headers: { cookie: `${name}=${value}` } });
}
it('grants one resource with a protected cookie and keeps uploaded files separate from books', () => {
  const response = grantAccess(NextResponse.json({}), 'upload', resource);
  const cookie = response.cookies.get(accessCookieName('upload', resource))!;
  const request = requestCookie(cookie.name, cookie.value);
  expect(readGrant(request, 'upload', resource)?.kind).toBe('upload');
  expect(readGrant(request, 'upload', 'uploads/another.png')).toBeNull();
  expect(hasBookAccess(request, resource)).toBe(false);
  expect(response.headers.get('set-cookie')).toMatch(/HttpOnly/i);
  expect(response.headers.get('set-cookie')).toMatch(/SameSite=lax/i);
  expect(response.headers.get('cache-control')).toContain('no-store');
});
it('rejects tampered, expired, malformed and cross-resource grants', () => {
  const grant = { kind: 'book' as const, resource: 'book-a', exp: Date.now() + 60000 };
  const signed = signGrant(grant);
  const name = accessCookieName('book', grant.resource);
  expect(hasBookAccess(requestCookie(name, signed), grant.resource)).toBe(true);
  expect(hasBookAccess(requestCookie(name, signed.slice(0, -3) + 'xxx'), grant.resource)).toBe(false);
  expect(hasBookAccess(requestCookie(name, signGrant({ ...grant, exp: Date.now() - 1 })), grant.resource)).toBe(false);
  expect(hasBookAccess(requestCookie(name, 'invalid'), grant.resource)).toBe(false);
  expect(hasBookAccess(requestCookie(accessCookieName('book', 'book-b'), signed), 'book-b')).toBe(false);
});
it('keeps trusted verification data server signed', () => {
  const appearance = { skinTone: 'test', hair: 'test', eyeColor: 'test' };
  const response = grantAccess(NextResponse.json({}), 'verified-upload', resource, appearance);
  const cookie = response.cookies.get(accessCookieName('upload', resource))!;
  expect(readGrant(requestCookie(cookie.name, cookie.value), 'upload', resource)).toMatchObject({ kind: 'verified-upload', appearance });
});
it('rejects arbitrary remote URLs, traversal, nested paths and executable uploads', () => {
  for (const path of ['https://example.com/photo.jpg', '../uploads/a.png', 'uploads/../a.png', 'uploads/a/b.png', 'uploads/a.svg', 'uploads/a.png?x=y']) expect(isUploadPath(path)).toBe(false);
  expect(isUploadPath(resource)).toBe(true);
});

it('bounds appearance in actual UTF8 bytes so every successful grant fits browser cookies', () => {
  expect(verifiedAppearance({ skinTone: '🌟'.repeat(250), hair: 'test', eyeColor: 'test' })).toBeNull();
  expect(verifiedAppearance({ skinTone: 'test', hair: '', eyeColor: 'test' })).toBeNull();
  expect(verifiedAppearance({ skinTone: ' test ', hair: 'test', eyeColor: 'test' })).toEqual({ skinTone: 'test', hair: 'test', eyeColor: 'test' });
  const appearance = { skinTone: 'a'.repeat(200), hair: 'b'.repeat(200), eyeColor: 'c'.repeat(200) };
  const response = grantAccess(NextResponse.json({}), 'verified-upload', resource, appearance);
  expect(Buffer.byteLength(response.headers.get('set-cookie')!)).toBeLessThan(4096);
});
