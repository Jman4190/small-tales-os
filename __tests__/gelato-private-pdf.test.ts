import { requireAdminUser } from '@/lib/admin-auth';

const from = jest.fn();
const createSignedUrl = jest.fn();
jest.mock('@supabase/supabase-js', () => ({ createClient: () => ({
  from: (...args: unknown[]) => from(...args),
  storage: { from: () => ({ createSignedUrl: (...args: unknown[]) => createSignedUrl(...args) }) },
}) }));
jest.mock('@/lib/admin-auth', () => ({ requireAdminUser: jest.fn().mockResolvedValue({ ok: false, status: 401, error: 'Denied' }) }));
jest.mock('@/lib/book-logger', () => ({ logBookEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/slack', () => ({ notifyOrderUpdate: jest.fn().mockResolvedValue(undefined) }));

const priorGelatoKey = process.env.GELATO_API_KEY;
process.env.GELATO_API_KEY = 'synthetic-gelato-key';
const { POST: createOrder } = require('@/app/api/gelato/create-order/route');
const { POST: refreshUrl } = require('@/app/api/refresh-signed-url/route');
const originalFetch = global.fetch;
const relativePdf = 'pdfs/orders/synthetic/generated.pdf';
const signedPdf = `https://your-project.supabase.co/storage/v1/object/sign/book-photos/${relativePdf}?token=fresh-token`;
let approval: Record<string, unknown>;
let fetchMock: jest.Mock;
let providerPayload: any;

function request() {
  return new Request('http://localhost:3000/api/gelato/create-order', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': process.env.INTERNAL_API_SECRET! },
    body: JSON.stringify({ approvalId: 'synthetic-approval', printJobId: 'synthetic-print-job' }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  providerPayload = undefined;
  approval = { id: 'synthetic-approval', book_id: 'synthetic-book', order_id: 'synthetic-order', status: 'approved', pdf_url: relativePdf };
  const order = { id: 'synthetic-order', customer_email: 'synthetic@example.invalid', customer_name: 'Synthetic Customer',
    ship_line1: '1 Example Street', ship_city: 'Example', ship_postal: '10001', ship_country: 'US' };
  from.mockImplementation((table: string) => {
    const query: any = { error: null };
    for (const method of ['select', 'eq', 'update']) query[method] = () => query;
    query.single = async () => ({ data: table === 'book_approvals' ? approval : order, error: null });
    return query;
  });
  createSignedUrl.mockResolvedValue({ data: { signedUrl: signedPdf }, error: null });
  fetchMock = jest.fn(async (input: string | URL, init: RequestInit) => {
    const url = new URL(input);
    if (url.pathname === '/api/refresh-signed-url') {
      // Exercise the actual protected signing route, not an always-successful
      // replacement. Missing internal authentication would produce a 401 here.
      return refreshUrl(new Request(url, init));
    }
    if (url.hostname === 'order.gelatoapis.com') {
      providerPayload = JSON.parse(init.body as string);
      return new Response(JSON.stringify({ id: 'synthetic-gelato-order' }));
    }
    throw new Error('Unexpected network destination');
  });
  global.fetch = fetchMock;
});

afterEach(() => { global.fetch = originalFetch; });
afterAll(() => {
  if (priorGelatoKey === undefined) delete process.env.GELATO_API_KEY;
  else process.env.GELATO_API_KEY = priorGelatoKey;
});

it.each([
  relativePdf,
  `https://your-project.supabase.co/storage/v1/object/public/book-photos/${relativePdf}`,
  `https://your-project.supabase.co/storage/v1/object/sign/book-photos/${relativePdf}?token=old-token`,
])('prints only with a fresh authorized signed URL for locator %s', async (locator) => {
  approval.pdf_url = locator;
  expect((await createOrder(request())).status).toBe(200);
  expect(requireAdminUser).not.toHaveBeenCalled();
  expect(createSignedUrl).toHaveBeenCalledWith(relativePdf, 172800, { download: true });
  expect(providerPayload.items[0].files[0].url).toBe(signedPdf);
  const refreshOptions = fetchMock.mock.calls[0][1];
  expect(new Headers(refreshOptions.headers).get('X-Internal-Secret')).toBe(process.env.INTERNAL_API_SECRET);
  expect(refreshOptions.redirect).toBe('error');
});

it('does not attempt printing when private storage signing fails', async () => {
  createSignedUrl.mockResolvedValue({ data: null, error: { message: 'Object missing' } });
  expect((await createOrder(request())).status).toBe(503);
  expect(providerPayload).toBeUndefined();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('does not fall back to the original locator when refresh is denied', async () => {
  fetchMock.mockResolvedValue(new Response('{}', { status: 401 }));
  expect((await createOrder(request())).status).toBe(503);
  expect(providerPayload).toBeUndefined();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it.each([
  'uploads/not-a-print.pdf',
  'pdfs/../private.pdf',
  'https://untrusted.example/storage/v1/object/public/book-photos/pdfs/private.pdf',
])('rejects an invalid locator before any signing or printing: %s', async (locator) => {
  approval.pdf_url = locator;
  expect((await createOrder(request())).status).toBe(503);
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each([
  `https://your-project.supabase.co/storage/v1/object/public/book-photos/${relativePdf}`,
  `https://untrusted.example/storage/v1/object/sign/book-photos/${relativePdf}?token=fake`,
  'https://your-project.supabase.co/storage/v1/object/sign/book-photos/pdfs/different.pdf?token=fake',
])('does not print with an invalid signing response: %s', async (url) => {
  createSignedUrl.mockResolvedValue({ data: { signedUrl: url }, error: null });
  expect((await createOrder(request())).status).toBe(503);
  expect(providerPayload).toBeUndefined();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
