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
jest.mock('@/inngest/client', () => ({ inngest: { send: jest.fn().mockResolvedValue({ ids: ['synthetic-event'] }) } }));
jest.mock('@/lib/slack', () => ({ notifyStripeCheckout: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/facebook', () => ({ sendFacebookPurchaseEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/posthog-tracker', () => ({ trackCheckoutAndPayment: jest.fn().mockResolvedValue(undefined) }));

const bookId = '00000000-0000-4000-8000-000000000001';
const orderId = '00000000-0000-4000-8000-000000000002';
const orderQuery: any = {};
const bookQuery: any = {};
const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = 'synthetic-webhook-secret';
  (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue({ type: 'checkout.session.completed', data: { object: { id: 'cs_test_synthetic' } } });
  for (const query of [orderQuery, bookQuery]) {
    query.error = null;
    for (const method of ['select', 'eq', 'is', 'update']) query[method] = jest.fn(() => query);
    query.single = jest.fn().mockResolvedValue({ data: { id: query === orderQuery ? orderId : bookId, name: 'Synthetic', gender: 'boy', age: 5 }, error: null });
    query.maybeSingle = query.single;
  }
  // Model the fresh schema's boolean NOT NULL column at the actual write.
  orderQuery.update.mockImplementation((values: Record<string, unknown>) => {
    if (typeof values.receive_pdf_preview_via_text !== 'boolean') {
      orderQuery.error = { message: 'receive_pdf_preview_via_text must be a nonnull boolean' };
    }
    return orderQuery;
  });
  (supabase.from as jest.Mock).mockImplementation((table: string) => table === 'orders' ? orderQuery : bookQuery);
});

afterAll(() => {
  if (originalWebhookSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
  else process.env.STRIPE_WEBHOOK_SECRET = originalWebhookSecret;
});

it.each([
  [undefined, false],
  ['yes', true],
  ['no', false],
  ['true', false],
  ['', false],
])('completes payment with a safe legacy SMS boolean for dropdown value %s', async (value, expected) => {
  (stripe.checkout.sessions.retrieve as jest.Mock).mockResolvedValue({
    id: 'cs_test_synthetic', payment_status: 'paid', metadata: { bookId }, amount_total: 3999, currency: 'usd',
    customer_details: { email: 'synthetic@example.invalid', name: 'Synthetic Customer' },
    ...(value === undefined ? {} : { custom_fields: [{ key: 'receivepdfpreviewviatext', type: 'dropdown', dropdown: { value } }] }),
  });
  const response = await POST(new Request('https://example.invalid/api/stripe/webhooks', { method: 'POST', body: '{}' }));
  expect(response.status).toBe(200);
  expect(orderQuery.update).toHaveBeenCalledWith(expect.objectContaining({
    payment_status: 'paid', receive_pdf_preview_via_text: expected,
  }));
  // Current consent was recorded explicitly at checkout. A legacy field cannot
  // add/remove that opt-in or replace its timestamp.
  const values = orderQuery.update.mock.calls[0][0];
  expect(values).not.toHaveProperty('sms_preview_opt_in');
  expect(values).not.toHaveProperty('sms_preview_opted_in_at');
  expect(inngest.send).toHaveBeenCalledWith(expect.objectContaining({ name: 'stripe/checkout.completed' }));
});
