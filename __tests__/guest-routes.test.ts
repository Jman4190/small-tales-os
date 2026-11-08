import { NextResponse } from 'next/server';
import { accessCookieName, grantAccess } from '@/lib/guest-access';

const bookId = '123e4567-e89b-42d3-a456-426614174000';
const photo = 'uploads/anonymous_123-abcd.png';
const query: any = {};
const storage = { createSignedUploadUrl: jest.fn() };
const send = jest.fn();
const rpc = jest.fn();
jest.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc: (...args: any[]) => rpc(...args), from: () => query, storage: { from: () => storage } }) }));
jest.mock('@/inngest/client', () => ({ inngest: { send: (...args: any[]) => send(...args) } }));
jest.mock('@/lib/book-logger', () => ({ logBookEvent: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/posthog-tracker', () => ({ trackPostHogEvent: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/request-security', () => ({ guardPublicRequest: jest.fn().mockResolvedValue(null), guardAiBudget: jest.fn().mockResolvedValue(null) }));
import { GET as upload } from '@/app/api/get-upload-url/route';
import { POST as createBook } from '@/app/api/create-book/route';
import { GET as status } from '@/app/api/book-status/[bookId]/route';

function cookieHeader(response: NextResponse) { return response.cookies.getAll().map(c => `${c.name}=${c.value}`).join('; '); }
function post(body: unknown, cookie = '') { return new Request('https://example.com/api/create-book', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(body) }); }
beforeEach(() => {
  jest.clearAllMocks();
  for (const method of ['select', 'eq', 'insert', 'update', 'in']) query[method] = jest.fn(() => query);
  query.single = jest.fn().mockResolvedValue({ data: { id: bookId, name: 'Test', gender: 'boy', age: 4, original_image_url: photo, appearance: { skinTone: 'verified', hair: 'verified', eyeColor: 'verified' } }, error: null });
  rpc.mockResolvedValue({ data: { book: { id: bookId, name: 'Test', gender: 'boy', age: 4, status: 'pending_verification', original_image_url: photo, appearance: { skinTone: 'verified', hair: 'verified', eyeColor: 'verified' } }, created: true }, error: null });
  send.mockResolvedValue({ ids: ['test'] });
});
it('issues an upload-specific cookie and never trusts an arbitrary file path', async () => {
  storage.createSignedUploadUrl.mockResolvedValue({ data: { signedUrl: 'https://example.com/upload', path: photo }, error: null });
  const response = await upload(new Request('https://example.com/api/get-upload-url?fileType=image/png'));
  expect(response.status).toBe(200);
  expect(cookieHeader(response)).toContain(accessCookieName('upload', photo));
  expect((await createBook(post({ name: 'Test', gender: 'boy', age: 4, filePath: photo, appearance: {} }, cookieHeader(response)))).status).toBe(403);
  expect(rpc).not.toHaveBeenCalled();
});
it('creates a book from server-verified appearance and authorizes only its browser', async () => {
  const appearance = { skinTone: 'verified', hair: 'verified', eyeColor: 'verified' };
  const verified = grantAccess(NextResponse.json({}), 'verified-upload', photo, appearance);
  const response = await createBook(post({ name: 'Test', gender: 'boy', age: 4, filePath: photo, appearance: { skinTone: 'forged' } }, cookieHeader(verified)));
  expect(response.status).toBe(200);
  expect(rpc).toHaveBeenCalledWith('create_book_from_upload', expect.objectContaining({ p_book: expect.objectContaining({ appearance }) }));
  expect(send).toHaveBeenCalledTimes(1);
  expect((await response.json()).data.id).toBe(bookId);
  const ownedRequest = new Request(`https://example.com/api/book-status/${bookId}`, { headers: { cookie: cookieHeader(response) } });
  expect((await status(ownedRequest, { params: Promise.resolve({ bookId }) })).status).toBe(200);
  query.select.mockClear();
  expect((await status(new Request(`https://example.com/api/book-status/${bookId}`), { params: Promise.resolve({ bookId }) })).status).toBe(404);
  expect(query.select).not.toHaveBeenCalled();
});
it('rejects malformed input before storage, database or paid work', async () => {
  expect((await upload(new Request('https://example.com/api/get-upload-url?fileType=text/html'))).status).toBe(400);
  expect((await createBook(post({ name: 'Test', gender: 'boy', age: -1, filePath: photo }))).status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
});

it('recovers event-send failures with the same reserved book and event identity', async () => {
  const appearance = { skinTone: 'verified', hair: 'verified', eyeColor: 'verified' };
  const cookie = cookieHeader(grantAccess(NextResponse.json({}), 'verified-upload', photo, appearance));
  const body = { name: 'Test', gender: 'boy', age: 4, filePath: photo };
  send.mockRejectedValueOnce(new Error('network'));
  const failed = await createBook(post(body, cookie));
  expect(failed.status).toBe(503);
  expect(cookieHeader(failed)).toContain(accessCookieName('book', bookId));
  expect(query.update).toHaveBeenCalledWith({ status: 'queue_failed' });
  const retry = await createBook(post(body, cookie));
  expect(retry.status).toBe(200);
  expect(send.mock.calls[0][0].id).toBe(`book-preview-${bookId}`);
  expect(send.mock.calls[1][0].id).toBe(`book-preview-${bookId}`);
});
it('does not enqueue another job for an already processing or completed book', async () => {
  const cookie = cookieHeader(grantAccess(NextResponse.json({}), 'verified-upload', photo, { skinTone: 'verified', hair: 'verified', eyeColor: 'verified' }));
  rpc.mockResolvedValue({ data: { book: { id: bookId, status: 'completed' }, created: false }, error: null });
  expect((await createBook(post({ name: 'Test', gender: 'boy', age: 4, filePath: photo }, cookie))).status).toBe(200);
  expect(send).not.toHaveBeenCalled();
});
it('rejects primitive or oversized JSON before database work', async () => {
  expect((await createBook(post(null))).status).toBe(400);
  expect((await createBook(post({ payload: 'a'.repeat(17000) }))).status).toBe(413);
  expect(rpc).not.toHaveBeenCalled();
});
