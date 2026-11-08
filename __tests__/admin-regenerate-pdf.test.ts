import { POST } from '@/app/api/regenerate-pdf/route';
import { requireAdminUser } from '@/lib/admin-auth';
import { inngest } from '@/inngest/client';

jest.mock('@/lib/admin-auth', () => ({ requireAdminUser: jest.fn() }));
jest.mock('@/inngest/client', () => ({ inngest: { send: jest.fn() } }));

const bookId = '1c26147d-cb90-4d5d-8032-fbf6753445cb';
const orderId = '21834fd0-0c13-423f-91bc-ab7d876fa875';
const query: any = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn() };
const from = jest.fn();

function request(body: unknown = { bookId, orderId }) {
  return new Request('http://localhost/api/regenerate-pdf', { method: 'POST', body: JSON.stringify(body) });
}

beforeEach(() => {
  jest.clearAllMocks();
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: { id: orderId }, error: null });
  from.mockReturnValue(query);
  (requireAdminUser as jest.Mock).mockResolvedValue({ ok: true, user: { id: 'admin' }, supabase: { from } });
});

it.each([401, 403])('denies access before reading the request or queuing a job (%s)', async (status) => {
  (requireAdminUser as jest.Mock).mockResolvedValue({ ok: false, status, error: 'Denied' });
  expect((await POST(request())).status).toBe(status);
  expect(from).not.toHaveBeenCalled();
  expect(inngest.send).not.toHaveBeenCalled();
});

it.each([null, {}, { bookId: 'invalid', orderId }, { bookId, orderId: 4 }])('rejects invalid input: %s', async (body) => {
  expect((await POST(request(body))).status).toBe(400);
  expect(inngest.send).not.toHaveBeenCalled();
});

it('rejects malformed JSON', async () => {
  const malformed = new Request('http://localhost/api/regenerate-pdf', { method: 'POST', body: '{' });
  expect((await POST(malformed)).status).toBe(400);
});

it('refuses a nonexistent, unpaid, or mismatched order', async () => {
  query.maybeSingle.mockResolvedValue({ data: null, error: null });
  expect((await POST(request())).status).toBe(404);
  expect(query.eq.mock.calls).toEqual([['id', orderId], ['book_id', bookId], ['payment_status', 'paid']]);
  expect(inngest.send).not.toHaveBeenCalled();
});

it('queues the matching paid order with the verified administrator identity', async () => {
  expect((await POST(request())).status).toBe(200);
  expect(inngest.send).toHaveBeenCalledWith({
    name: 'book/pdf.regenerate.requested', data: { bookId, orderId }, user: { id: 'admin' },
  });
});
