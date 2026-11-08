import { notifyPdfGeneration } from '@/lib/slack';

const from = jest.fn();
jest.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: (...args: unknown[]) => from(...args) }) }));
jest.mock('@/lib/book-logger', () => ({ logBookEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/inngest/client', () => ({ inngest: { createFunction: (_config: unknown, _event: unknown, handler: unknown) => handler } }));
const { triggerGelatoOrderFromRegeneration: regenerate } = require('@/inngest/functions/triggerGelatoOrderFromRegeneration');

const originalFetch = global.fetch;
const priorWebhook = process.env.CREATE_BOOK_SLACK_WEBHOOK_URL;
const relativePdf = 'pdfs/orders/synthetic/regenerated.pdf';
const signedPdf = `https://your-project.supabase.co/storage/v1/object/sign/book-photos/${relativePdf}?token=fresh-token`;
let fetchMock: jest.Mock;
const pdfData = { bookId: 'synthetic-book', orderId: 'synthetic-order', characterName: 'Synthetic', characterGender: 'boy', pdfUrl: relativePdf };

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CREATE_BOOK_SLACK_WEBHOOK_URL = 'https://slack.example.invalid/synthetic';
  from.mockImplementation((table: string) => {
    const approval = { id: 'synthetic-approval', status: 'approved', print_job_id: 'synthetic-job', pdf_url: relativePdf };
    const order = { id: 'synthetic-order', customer_email: 'synthetic@example.invalid', customer_name: 'Synthetic Customer',
      ship_line1: '1 Example Street', ship_city: 'Example', ship_postal: '10001', ship_country: 'US' };
    const query: any = {};
    for (const method of ['select', 'eq', 'order', 'limit']) query[method] = () => query;
    query.single = query.maybeSingle = async () => ({ data: table === 'book_approvals' ? approval : order, error: null });
    return query;
  });
  fetchMock = jest.fn(async (input: string | URL) => {
    if (new URL(input).pathname === '/api/refresh-signed-url') return Response.json({ signedUrl: signedPdf });
    return Response.json({ id: 'synthetic-provider-result' });
  });
  global.fetch = fetchMock;
});

afterEach(() => { global.fetch = originalFetch; });
afterAll(() => {
  if (priorWebhook === undefined) delete process.env.CREATE_BOOK_SLACK_WEBHOOK_URL;
  else process.env.CREATE_BOOK_SLACK_WEBHOOK_URL = priorWebhook;
});

function runRegeneration(pdfUrl = relativePdf) {
  return regenerate({ event: { data: { bookId: 'synthetic-book', orderId: 'synthetic-order', pdfUrl } },
    step: { run: async (_id: string, work: () => unknown) => work() } });
}

it('authenticates both refresh and direct-print calls when regenerating an approved book', async () => {
  await runRegeneration();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  for (const [, options] of fetchMock.mock.calls) {
    expect(new Headers(options.headers).get('X-Internal-Secret')).toBe(process.env.INTERNAL_API_SECRET);
  }
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).pdfUrl).toBe(signedPdf);
});

it('does not trigger printing when regeneration refresh is denied', async () => {
  fetchMock.mockResolvedValue(new Response('{}', { status: 401 }));
  await expect(runRegeneration()).rejects.toThrow('Unable to refresh private PDF');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('does not trigger signing or printing for an invalid regenerated PDF path', async () => {
  await expect(runRegeneration('uploads/invalid.pdf')).rejects.toThrow('PDF storage path is not allowed');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('authenticates Slack PDF refresh without passing internal credentials to Slack', async () => {
  await notifyPdfGeneration(pdfData);
  expect(new Headers(fetchMock.mock.calls[0][1].headers).get('X-Internal-Secret')).toBe(process.env.INTERNAL_API_SECRET);
  expect(new Headers(fetchMock.mock.calls[1][1].headers).has('X-Internal-Secret')).toBe(false);
  expect(fetchMock.mock.calls[1][1].body).toContain(signedPdf);
});

it('sends Slack a link-unavailable notice instead of an unsafe fallback when signing fails', async () => {
  fetchMock.mockImplementation(async (input: string | URL) =>
    new URL(input).pathname === '/api/refresh-signed-url' ? new Response('{}', { status: 401 }) : Response.json({ ok: true }));
  await notifyPdfGeneration(pdfData);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  const message = fetchMock.mock.calls[1][1].body;
  expect(message).toContain('PDF link temporarily unavailable');
  expect(message).not.toContain(relativePdf);
});
