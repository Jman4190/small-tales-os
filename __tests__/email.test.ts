import React from 'react';
import {
  EMAIL_FROM_UPDATES,
  getEmailProvider,
  PermanentEmailError,
  sendEmail,
  sendCloudflareEmail,
  sendResendEmail,
} from '@/lib/email';

function restoreEnvironmentVariable(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function cloudflareResponse(
  overrides: Partial<{
    ok: boolean;
    status: number;
    success: boolean;
    errors: Array<{ code: number; message: string }>;
    delivered: string[];
    queued: string[];
    permanentBounces: string[];
  }> = {},
) {
  const values = {
    ok: true,
    status: 200,
    success: true,
    errors: [],
    delivered: ['reader@example.com'],
    queued: [],
    permanentBounces: [],
    ...overrides,
  };

  return {
    ok: values.ok,
    status: values.status,
    json: async () => ({
      success: values.success,
      errors: values.errors,
      messages: [],
      result: values.success
        ? {
            message_id: '<cloudflare-message-id@example.com>',
            delivered: values.delivered,
            queued: values.queued,
            permanent_bounces: values.permanentBounces,
          }
        : null,
    }),
  } as Response;
}

describe('Cloudflare email sender', () => {
  it('rejects unapproved sender addresses before contacting a provider', async () => {
    const fetcher = jest.fn();

    await expect(
      sendCloudflareEmail(
        {
          from: { address: 'attacker@example.com' },
          to: 'reader@example.com',
          subject: 'Invalid sender',
          text: 'Invalid sender',
        },
        {
          accountId: 'account-id',
          apiToken: 'secret-token',
          fetcher: fetcher as unknown as typeof fetch,
        },
      ),
    ).rejects.toBeInstanceOf(PermanentEmailError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('maps a named message to the Cloudflare API and normalizes the result', async () => {
    const fetcher = jest.fn().mockResolvedValue(cloudflareResponse());

    const result = await sendCloudflareEmail(
      {
        from: EMAIL_FROM_UPDATES,
        to: 'reader@example.com',
        subject: 'Preview ready',
        html: '<h1>Ready</h1>',
        text: 'Ready',
        replyTo: { address: 'support@example.com', name: 'Support' },
        headers: { 'X-Email-Type': 'preview' },
      },
      {
        accountId: 'account-id',
        apiToken: 'secret-token',
        fetcher: fetcher as unknown as typeof fetch,
      },
    );

    expect(result).toEqual({
      id: '<cloudflare-message-id@example.com>',
      provider: 'cloudflare',
      delivered: ['reader@example.com'],
      queued: [],
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(
      'https://api.cloudflare.com/client/v4/accounts/account-id/email/sending/send',
    );
    expect(init.headers.Authorization).toBe('Bearer secret-token');
    expect(JSON.parse(init.body)).toEqual({
      from: EMAIL_FROM_UPDATES,
      to: 'reader@example.com',
      subject: 'Preview ready',
      html: '<h1>Ready</h1>',
      text: 'Ready',
      reply_to: { address: 'support@example.com', name: 'Support' },
      headers: { 'X-Email-Type': 'preview' },
    });
  });

  it('renders React templates as both HTML and plain text', async () => {
    const fetcher = jest.fn().mockResolvedValue(cloudflareResponse());

    await sendCloudflareEmail(
      {
        from: EMAIL_FROM_UPDATES,
        to: 'reader@example.com',
        subject: 'Rendered email',
        react: React.createElement('p', null, 'Hello reader'),
      },
      {
        accountId: 'account-id',
        apiToken: 'secret-token',
        fetcher: fetcher as unknown as typeof fetch,
      },
    );

    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.html).toContain('<p>Hello reader</p>');
    expect(body.text).toBe('Hello reader');
  });

  it('accepts a queued message as a successful provider handoff', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      cloudflareResponse({ delivered: [], queued: ['reader@example.com'] }),
    );

    const result = await sendCloudflareEmail(
      {
        from: EMAIL_FROM_UPDATES,
        to: 'reader@example.com',
        subject: 'Queued email',
        text: 'Queued',
      },
      {
        accountId: 'account-id',
        apiToken: 'secret-token',
        fetcher: fetcher as unknown as typeof fetch,
      },
    );

    expect(result.queued).toEqual(['reader@example.com']);
  });

  it('throws provider details for retryable HTTP failures', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      cloudflareResponse({
        ok: false,
        status: 429,
        success: false,
        errors: [{ code: 10004, message: 'email.sending.error.throttled' }],
      }),
    );

    await expect(
      sendCloudflareEmail(
        {
          from: EMAIL_FROM_UPDATES,
          to: 'reader@example.com',
          subject: 'Retry email',
          text: 'Retry',
        },
        {
          accountId: 'account-id',
          apiToken: 'secret-token',
          fetcher: fetcher as unknown as typeof fetch,
        },
      ),
    ).rejects.toThrow(
      'Cloudflare email request failed (429): email.sending.error.throttled',
    );
  });

  it('classifies Cloudflare configuration failures as permanent', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      cloudflareResponse({
        ok: false,
        status: 403,
        success: false,
        errors: [{ code: 10102, message: 'email.sending.error.authentication.forbidden' }],
      }),
    );

    await expect(
      sendCloudflareEmail(
        {
          from: EMAIL_FROM_UPDATES,
          to: 'reader@example.com',
          subject: 'Invalid configuration',
          text: 'Invalid configuration',
        },
        {
          accountId: 'account-id',
          apiToken: 'secret-token',
          fetcher: fetcher as unknown as typeof fetch,
        },
      ),
    ).rejects.toBeInstanceOf(PermanentEmailError);
  });

  it('rejects a permanent bounce even when the API request succeeded', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      cloudflareResponse({
        delivered: [],
        permanentBounces: ['bad@example.com'],
      }),
    );

    await expect(
      sendCloudflareEmail(
        {
          from: EMAIL_FROM_UPDATES,
          to: 'bad@example.com',
          subject: 'Bounce email',
          text: 'Bounce',
        },
        {
          accountId: 'account-id',
          apiToken: 'secret-token',
          fetcher: fetcher as unknown as typeof fetch,
        },
      ),
    ).rejects.toBeInstanceOf(PermanentEmailError);
  });

  it('fails before making a request when credentials are missing', async () => {
    const originalAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const originalToken = process.env.CLOUDFLARE_EMAIL_API_TOKEN;
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_EMAIL_API_TOKEN;

    try {
      await expect(
        sendCloudflareEmail({
          from: EMAIL_FROM_UPDATES,
          to: 'reader@example.com',
          subject: 'Missing config',
          text: 'Missing config',
        }),
      ).rejects.toThrow(
        'CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_EMAIL_API_TOKEN are required',
      );
    } finally {
      restoreEnvironmentVariable('CLOUDFLARE_ACCOUNT_ID', originalAccountId);
      restoreEnvironmentVariable('CLOUDFLARE_EMAIL_API_TOKEN', originalToken);
    }
  });
});

describe('Resend rollback sender', () => {
  it('normalizes a successful Resend response', async () => {
    const send = jest.fn().mockResolvedValue({
      data: { id: 'resend-message-id' },
      error: null,
    });

    const result = await sendResendEmail(
      {
        from: EMAIL_FROM_UPDATES,
        to: 'reader@example.com',
        subject: 'Rollback email',
        text: 'Rollback',
      },
      { client: { emails: { send } } },
    );

    expect(result).toEqual({ id: 'resend-message-id', provider: 'resend' });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Storybook Starter <updates@updates.example.com>',
        to: 'reader@example.com',
        subject: 'Rollback email',
        text: 'Rollback',
      }),
    );
  });

  it('throws the Resend API error so callers can retry', async () => {
    const send = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'rate limit exceeded' },
    });

    await expect(
      sendResendEmail(
        {
          from: EMAIL_FROM_UPDATES,
          to: 'reader@example.com',
          subject: 'Rollback error',
          text: 'Rollback error',
        },
        { client: { emails: { send } } },
      ),
    ).rejects.toThrow('Resend email request failed: rate limit exceeded');
  });

  it('classifies Resend validation failures as permanent', async () => {
    const send = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'invalid sender', name: 'invalid_from_address' },
    });

    await expect(
      sendResendEmail(
        {
          from: EMAIL_FROM_UPDATES,
          to: 'reader@example.com',
          subject: 'Rollback validation error',
          text: 'Rollback validation error',
        },
        { client: { emails: { send } } },
      ),
    ).rejects.toBeInstanceOf(PermanentEmailError);
  });
});

describe('email provider selection', () => {
  const originalProvider = process.env.EMAIL_PROVIDER;

  afterEach(() => {
    restoreEnvironmentVariable('EMAIL_PROVIDER', originalProvider);
  });

  it('defaults to Cloudflare after the production cutover', () => {
    delete process.env.EMAIL_PROVIDER;
    expect(getEmailProvider()).toBe('cloudflare');
  });

  it('allows Cloudflare to be selected explicitly', () => {
    process.env.EMAIL_PROVIDER = 'cloudflare';
    expect(getEmailProvider()).toBe('cloudflare');
  });

  it('rejects an unknown provider', () => {
    process.env.EMAIL_PROVIDER = 'unknown';
    expect(() => getEmailProvider()).toThrow('Unsupported EMAIL_PROVIDER: unknown');
  });

  it('dispatches to Cloudflare when Cloudflare is selected', async () => {
    const fetcher = jest.fn().mockResolvedValue(cloudflareResponse());

    const result = await sendEmail(
      {
        from: EMAIL_FROM_UPDATES,
        to: 'reader@example.com',
        subject: 'Cloudflare dispatch',
        text: 'Cloudflare dispatch',
      },
      {
        provider: 'cloudflare',
        cloudflare: {
          accountId: 'account-id',
          apiToken: 'secret-token',
          fetcher: fetcher as unknown as typeof fetch,
        },
      },
    );

    expect(result.provider).toBe('cloudflare');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('dispatches to Resend when Resend is selected', async () => {
    const send = jest.fn().mockResolvedValue({
      data: { id: 'resend-message-id' },
      error: null,
    });

    const result = await sendEmail(
      {
        from: EMAIL_FROM_UPDATES,
        to: 'reader@example.com',
        subject: 'Resend dispatch',
        text: 'Resend dispatch',
      },
      {
        provider: 'resend',
        resend: { client: { emails: { send } } },
      },
    );

    expect(result.provider).toBe('resend');
    expect(send).toHaveBeenCalledTimes(1);
  });
});
