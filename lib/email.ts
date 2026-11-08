import 'server-only';

import { render } from '@react-email/render';
import type { ReactElement } from 'react';
import { Resend, type CreateEmailOptions } from 'resend';

export type EmailProvider = 'cloudflare' | 'resend';

export interface EmailAddress {
  address: string;
  name?: string;
}

export interface EmailMessage {
  from: EmailAddress;
  to: string;
  subject: string;
  react?: ReactElement;
  html?: string;
  text?: string;
  replyTo?: EmailAddress;
  headers?: Record<string, string>;
}

export interface EmailSendResult {
  id: string;
  provider: EmailProvider;
  delivered?: string[];
  queued?: string[];
}

interface CloudflareSendOptions {
  accountId?: string;
  apiToken?: string;
  fetcher?: typeof fetch;
}

interface ResendSendOptions {
  apiKey?: string;
  client?: {
    emails: {
      send: (message: CreateEmailOptions) => Promise<{
        data: { id: string } | null;
        error: { message: string; name?: string } | null;
      }>;
    };
  };
}

export interface SendEmailOptions {
  provider?: EmailProvider;
  cloudflare?: CloudflareSendOptions;
  resend?: ResendSendOptions;
}

export class PermanentEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentEmailError';
  }
}

interface CloudflareSendResponse {
  success: boolean;
  errors: Array<{ code: number | string; message: string }>;
  result: {
    message_id: string;
    delivered: string[];
    queued: string[];
    permanent_bounces: string[];
  } | null;
}

export const EMAIL_FROM_UPDATES: EmailAddress = {
  address: 'updates@updates.example.com',
  name: 'Storybook Starter',
};

export const EMAIL_FROM_NOREPLY: EmailAddress = {
  address: 'noreply@updates.example.com',
  name: 'Storybook Starter',
};

export const EMAIL_REPLY_TO_SUPPORT: EmailAddress = {
  address: 'support@example.com',
  name: 'Storybook Starter Support',
};

const APPROVED_SENDERS = new Set([
  EMAIL_FROM_UPDATES.address,
  EMAIL_FROM_NOREPLY.address,
]);

function formatAddress({ address, name }: EmailAddress) {
  return name ? `${name} <${address}>` : address;
}

async function prepareMessage(message: EmailMessage) {
  if (!APPROVED_SENDERS.has(message.from.address)) {
    throw new PermanentEmailError(`Unapproved email sender: ${message.from.address}`);
  }

  if (message.react && (message.html || message.text)) {
    throw new Error('Email content must use either react or html/text, not both');
  }

  const html = message.react ? await render(message.react) : message.html;
  const text = message.react
    ? await render(message.react, { plainText: true })
    : message.text;

  if (!html && !text) {
    throw new Error('Email content is required');
  }

  return { html, text };
}

export function getEmailProvider(): EmailProvider {
  const provider = process.env.EMAIL_PROVIDER || 'cloudflare';
  if (provider !== 'cloudflare' && provider !== 'resend') {
    throw new Error(`Unsupported EMAIL_PROVIDER: ${provider}`);
  }
  return provider;
}

export async function sendCloudflareEmail(
  message: EmailMessage,
  options: CloudflareSendOptions = {},
): Promise<EmailSendResult> {
  const accountId = options.accountId || process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = options.apiToken || process.env.CLOUDFLARE_EMAIL_API_TOKEN;
  const fetcher = options.fetcher || fetch;

  if (!accountId || !apiToken) {
    throw new Error(
      'CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_EMAIL_API_TOKEN are required',
    );
  }

  const { html, text } = await prepareMessage(message);
  const response = await fetcher(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: message.from,
        to: message.to,
        subject: message.subject,
        ...(html ? { html } : {}),
        ...(text ? { text } : {}),
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
        ...(message.headers ? { headers: message.headers } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );

  let body: CloudflareSendResponse | null = null;
  try {
    body = (await response.json()) as CloudflareSendResponse;
  } catch {
    // The status and generic message below are more useful than a JSON parse error.
  }

  if (!response.ok || !body?.success || !body.result) {
    const details = body?.errors?.map((error) => error.message).join(', ');
    const message = `Cloudflare email request failed (${response.status})${details ? `: ${details}` : ''}`;
    const isPermanentClientError =
      response.status >= 400 &&
      response.status < 500 &&
      response.status !== 408 &&
      response.status !== 429;
    if (isPermanentClientError) {
      throw new PermanentEmailError(message);
    }
    throw new Error(message);
  }

  if (body.result.permanent_bounces.length > 0) {
    throw new PermanentEmailError(
      `Cloudflare permanently rejected: ${body.result.permanent_bounces.join(', ')}`,
    );
  }

  return {
    id: body.result.message_id,
    provider: 'cloudflare',
    delivered: body.result.delivered,
    queued: body.result.queued,
  };
}

export async function sendResendEmail(
  message: EmailMessage,
  options: ResendSendOptions = {},
): Promise<EmailSendResult> {
  const apiKey = options.apiKey || process.env.RESEND_API_KEY;
  if (!apiKey && !options.client) {
    throw new Error('RESEND_API_KEY is required');
  }

  const { html, text } = await prepareMessage(message);
  const resend = options.client || new Resend(apiKey!);
  const payload: CreateEmailOptions = {
    from: formatAddress(message.from),
    to: message.to,
    subject: message.subject,
    ...(html ? { html } : { text: text! }),
    ...(html && text ? { text } : {}),
    ...(message.replyTo ? { replyTo: formatAddress(message.replyTo) } : {}),
    ...(message.headers ? { headers: message.headers } : {}),
  };
  const { data, error } = await resend.emails.send(payload);

  if (error || !data?.id) {
    const message = `Resend email request failed: ${error?.message || 'missing message ID'}`;
    const retryableErrors = new Set([
      'rate_limit_exceeded',
      'application_error',
      'internal_server_error',
    ]);
    if (error?.name && !retryableErrors.has(error.name)) {
      throw new PermanentEmailError(message);
    }
    throw new Error(message);
  }

  return { id: data.id, provider: 'resend' };
}

export async function sendEmail(
  message: EmailMessage,
  options: SendEmailOptions = {},
) {
  const provider = options.provider || getEmailProvider();
  return provider === 'cloudflare'
    ? sendCloudflareEmail(message, options.cloudflare)
    : sendResendEmail(message, options.resend);
}
