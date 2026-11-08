describe('server analytics transport privacy', () => {
  const originalKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const originalHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  afterEach(() => {
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    else process.env.NEXT_PUBLIC_POSTHOG_KEY = originalKey;
    if (originalHost === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
    else process.env.NEXT_PUBLIC_POSTHOG_HOST = originalHost;
    jest.resetModules();
    jest.dontMock('posthog-node');
  });

  it('never identifies a customer and captures only anonymous payment metrics', async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'test-project';
    process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://analytics.example';
    const capture = jest.fn();
    const identify = jest.fn();
    jest.doMock('posthog-node', () => ({ PostHog: jest.fn(() => ({ capture, identify })) }));
    let tracker: typeof import('@/lib/posthog-tracker');
    jest.isolateModules(() => { tracker = require('@/lib/posthog-tracker'); });
    await tracker!.trackCheckoutAndPayment({
      bookId: 'private-book', orderId: 'private-order', customerEmail: 'parent@example.com',
      customerName: 'Parent Example', name: 'Child Example', age: 4, gender: 'girl',
      shippingAddress: { line1: '123 Quiet Lane' }, amount: 100, currency: 'USD',
    });
    expect(identify).not.toHaveBeenCalled();
    expect(capture).toHaveBeenCalledTimes(1);
    const payload = capture.mock.calls[0][0];
    expect(payload.properties).toEqual({ amount: 100, currency: 'USD', revenue: 1, $revenue: 1, $currency: 'USD' });
    expect(payload.distinctId).toMatch(/^[a-f0-9-]{36}$/);
    expect(JSON.stringify(payload)).not.toMatch(/parent|Child|Quiet|private-book|private-order/);
  });

  it('does not create an analytics client without both explicit settings', () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'test-project';
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
    const constructor = jest.fn();
    jest.doMock('posthog-node', () => ({ PostHog: constructor }));
    jest.isolateModules(() => { require('@/lib/posthog-tracker'); });
    expect(constructor).not.toHaveBeenCalled();
  });
});
