import { POST } from '@/app/api/stripe/webhooks/route';
import { stripe } from '@/lib/stripe';
import { supabase } from '@/utils/supabase';
import { inngest } from '@/inngest/client';

jest.mock('@/lib/stripe', () => ({ stripe: {
  webhooks: { constructEvent: jest.fn() },
  checkout: { sessions: { retrieve: jest.fn() } },
} }));
jest.mock('next/headers', () => ({ headers: jest.fn(async () => new Headers({ 'Stripe-Signature': 'synthetic-signature' })) }));
jest.mock('@/utils/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('@/inngest/client', () => ({ inngest: { send: jest.fn() } }));
jest.mock('@/lib/slack', () => ({ notifyStripeCheckout: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/facebook', () => ({ sendFacebookPurchaseEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/posthog-tracker', () => ({ trackCheckoutAndPayment: jest.fn().mockResolvedValue(undefined) }));

const bookId = '00000000-0000-4000-8000-000000000001';
const orderId = '00000000-0000-4000-8000-000000000002';
const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;
let order: Record<string, unknown>;
let book: Record<string, unknown>;
let session: Record<string, unknown>;

// Model the filtered writes, including zero matched rows, rather than merely
// asserting a query method was called. This catches paid-state regressions.
function query(table: string): any {
  const row = table === 'orders' ? order : book;
  const filters: Array<() => boolean> = [];
  let changes: Record<string, unknown> | undefined;
  const execute = () => {
    if (!filters.every(matches => matches())) return { data: null, error: null };
    if (changes) Object.assign(row, changes);
    return { data: { ...row }, error: null };
  };
  const builder: any = {
    select: () => builder,
    update: (values: Record<string, unknown>) => { changes = values; return builder; },
    eq: (key: string, value: unknown) => { filters.push(() => row[key] === value); return builder; },
    neq: (key: string, value: unknown) => { filters.push(() => row[key] !== value); return builder; },
    is: (key: string, value: unknown) => { filters.push(() => row[key] === value); return builder; },
    single: async () => execute(),
    maybeSingle: async () => execute(),
    then: (resolve: (result: unknown) => unknown) => Promise.resolve(execute()).then(resolve),
  };
  return builder;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = 'synthetic-webhook-secret';
  order = { id: orderId, book_id: bookId, stripe_session_id: 'cs_test_synthetic', payment_status: 'pending' };
  book = { id: bookId, order_id: null, status: 'completed', name: 'Synthetic', gender: 'boy', age: 5 };
  session = { id: 'cs_test_synthetic', metadata: { bookId }, payment_status: 'paid', amount_total: 3999, currency: 'usd' };
  (supabase.from as jest.Mock).mockImplementation(query);
  (stripe.checkout.sessions.retrieve as jest.Mock).mockImplementation(async () => session);
  (inngest.send as jest.Mock).mockResolvedValue({ ids: ['synthetic-job'] });
});

afterAll(() => {
  if (originalSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
  else process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
});

async function notify(type: string) {
  (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue({ type, data: { object: { id: session.id } } });
  return POST(new Request('https://example.invalid/api/stripe/webhooks', { method: 'POST', body: '{}' }));
}

it.each([
  ['checkout.session.completed', 'unpaid'],
  ['checkout.session.completed', 'unknown'],
  ['checkout.session.completed', 'no_payment_required'],
  ['checkout.session.async_payment_succeeded', 'unpaid'],
  ['checkout.session.async_payment_succeeded', 'unknown'],
  ['checkout.session.async_payment_succeeded', 'no_payment_required'],
])('does not fulfill %s with payment status %s', async (type, paymentStatus) => {
  session.payment_status = paymentStatus;
  expect((await notify(type)).status).toBe(200);
  expect(order.payment_status).toBe('pending');
  expect(book.status).toBe('completed');
  expect(supabase.from).not.toHaveBeenCalled();
  expect(inngest.send).not.toHaveBeenCalled();
});

it('fulfills a paid asynchronous payment notification', async () => {
  expect((await notify('checkout.session.async_payment_succeeded')).status).toBe(200);
  expect(order.payment_status).toBe('paid');
  expect(book).toMatchObject({ order_id: orderId, status: 'paid' });
  expect(inngest.send).toHaveBeenCalledWith(expect.objectContaining({
    id: 'stripe-checkout-cs_test_synthetic', name: 'stripe/checkout.completed',
    data: expect.objectContaining({ metadata: { bookId, orderId } }),
  }));
});

it('fulfills an authoritative zero-total Checkout session without requiring payment', async () => {
  session.payment_status = 'no_payment_required';
  session.amount_total = 0;
  expect((await notify('checkout.session.completed')).status).toBe(200);
  expect(order).toMatchObject({ payment_status: 'paid', total_amount: 0 });
  expect(book).toMatchObject({ order_id: orderId, status: 'paid' });
  expect(inngest.send).toHaveBeenCalledWith(expect.objectContaining({
    id: 'stripe-checkout-cs_test_synthetic', name: 'stripe/checkout.completed',
  }));
});

it.each(['checkout.session.expired', 'checkout.session.async_payment_failed'])('preserves a paid order and its progressing book on %s', async (type) => {
  // Model an out-of-order failure with a stale unpaid session but a paid row.
  session.payment_status = 'unpaid';
  order.payment_status = 'paid';
  book.order_id = orderId;
  book.status = 'processing';
  expect((await notify(type)).status).toBe(200);
  expect(order.payment_status).toBe('paid');
  expect(book.status).toBe('processing');
  expect(inngest.send).not.toHaveBeenCalled();
});

it.each(['checkout.session.expired', 'checkout.session.async_payment_failed'])('marks only the unpaid order failed on %s and keeps its preview reusable', async (type) => {
  session.payment_status = 'unpaid';
  expect((await notify(type)).status).toBe(200);
  expect(order.payment_status).toBe('failed');
  expect(book.status).toBe('completed');
  expect(inngest.send).not.toHaveBeenCalled();
});

it('uses the same fulfillment event identity after an uncertain send without resetting book progress', async () => {
  (inngest.send as jest.Mock).mockRejectedValueOnce(new Error('uncertain delivery'));
  expect((await notify('checkout.session.completed')).status).toBe(500);
  expect(order.payment_status).toBe('paid');
  book.status = 'processing';
  expect((await notify('checkout.session.async_payment_succeeded')).status).toBe(200);
  expect(book).toMatchObject({ order_id: orderId, status: 'processing' });
  const deliveries = (inngest.send as jest.Mock).mock.calls.map(([event]) => event.id);
  expect(deliveries).toEqual(['stripe-checkout-cs_test_synthetic', 'stripe-checkout-cs_test_synthetic']);
});

it('skips a failure notification when Stripe currently reports the session paid', async () => {
  expect((await notify('checkout.session.async_payment_failed')).status).toBe(200);
  expect(supabase.from).not.toHaveBeenCalled();
  expect(inngest.send).not.toHaveBeenCalled();
});
