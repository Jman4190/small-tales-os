import { NextRequest } from 'next/server';
import { serve } from 'inngest/next';
import { createHmac } from 'node:crypto';
import { readBoundedRequestBody, readBoundedJson, BodyLimitError } from '@/lib/request-body';

jest.mock('inngest/next', () => ({ serve: jest.fn(() => ({ GET: jest.fn(), POST: jest.fn(), PUT: jest.fn() })) }));
jest.mock('@/inngest/client', () => ({ inngest: {} }));
jest.mock('@/inngest/functions/generateBookImages', () => ({ generateBookImages: {} }));
jest.mock('@/inngest/functions/createBookImage', () => ({ createBookImage: {} }));
jest.mock('@/inngest/functions/generatePdfs', () => ({ generatePdfTrigger: {} }));
jest.mock('@/inngest/functions/sendPreviewEmail', () => ({ sendPreviewEmailTrigger: {} }));
jest.mock('@/inngest/functions/sendShippingEmail', () => ({ sendShippingEmailTrigger: {} }));
jest.mock('@/inngest/functions/regeneratePdf', () => ({ regeneratePdfTrigger: {} }));
jest.mock('@/inngest/functions/sendInternalPdfNotification', () => ({ sendInternalPdfNotificationTrigger: {} }));
jest.mock('@/inngest/functions/triggerGelatoOrderFromRegeneration', () => ({ triggerGelatoOrderFromRegeneration: {} }));
jest.mock('@/inngest/functions/resendPreviewEmail', () => ({ resendPreviewEmailTrigger: {} }));
jest.mock('@/inngest/functions/sendPreviewSms', () => ({ sendPreviewSmsTrigger: {}, resendPreviewSmsTrigger: {} }));
jest.mock('@/inngest/functions/notifyInngestFailure', () => ({ notifyInngestFailureTrigger: {} }));

const signingKey = 'signkey-test-body-limit-signing-key';
const previousSigningKey = process.env.INNGEST_SIGNING_KEY;
process.env.INNGEST_SIGNING_KEY = signingKey;
const { GET, POST, PUT } = require('@/app/api/inngest/route');
const sdk = (serve as jest.Mock).mock.results[0].value;
const sdkOptions = (serve as jest.Mock).mock.calls[0][0];
const LIMIT = 4 * 1024 * 1024;
const encoder = new TextEncoder();

function request(body?: BodyInit, headers: Record<string, string> = {}, method = 'POST') {
  return new NextRequest('http://localhost/api/inngest?fnId=test&stepId=step', {
    method, headers, body, ...(body instanceof ReadableStream ? { duplex: 'half' } : {}),
  } as RequestInit);
}

function streamed(chunks: Uint8Array[], headers: Record<string, string> = {}, method = 'POST') {
  const cancel = jest.fn();
  let index = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) controller.enqueue(chunks[index++]);
      else controller.close();
    },
    cancel,
  });
  return { req: request(stream, headers, method), cancel };
}

beforeEach(() => {
  jest.clearAllMocks();
  sdk.POST.mockResolvedValue(new Response('accepted', { status: 202 }));
  sdk.PUT.mockResolvedValue(new Response('registered', { status: 200 }));
  sdk.GET.mockResolvedValue(new Response('discovery', { status: 200 }));
});

afterAll(() => {
  if (previousSigningKey === undefined) delete process.env.INNGEST_SIGNING_KEY;
  else process.env.INNGEST_SIGNING_KEY = previousSigningKey;
});

it('preserves the SDK signing configuration and streaming mode', () => {
  expect(sdkOptions).toMatchObject({ signingKey, streaming: 'allow' });
});

it('forwards signed bytes, headers, method, URL, and context unchanged to the SDK', async () => {
  const body = '{ "event": { "data": "é and 🌟" } }\n';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', signingKey.replace(/^signkey-\w+-/, '')).update(body + timestamp).digest('hex');
  const header = `t=${timestamp}&s=${signature}`;
  const req = streamed([encoder.encode(body.slice(0, 10)), encoder.encode(body.slice(10))], {
    'x-inngest-signature': header, 'content-type': 'application/json',
    'content-length': String(encoder.encode(body).byteLength),
  }).req;
  const context = { params: Promise.resolve({}) };
  sdk.POST.mockImplementation(async (forwarded: NextRequest, forwardedContext: unknown) => {
    expect(forwarded).toBeInstanceOf(NextRequest);
    expect(forwarded.url).toBe(req.url);
    expect(forwarded.method).toBe('POST');
    expect(forwarded.headers.get('x-inngest-signature')).toBe(header);
    expect(forwarded.headers.get('content-type')).toBe('application/json');
    expect(forwardedContext).toBe(context);
    const actualBody = await forwarded.text();
    expect(actualBody).toBe(body);
    const actualSignature = createHmac('sha256', signingKey.replace(/^signkey-\w+-/, '')).update(actualBody + timestamp).digest('hex');
    expect(actualSignature).toBe(signature);
    return new Response('signed request accepted', { status: 202 });
  });
  expect((await POST(req, context)).status).toBe(202);
  expect(sdk.POST).toHaveBeenCalledTimes(1);
});

it.each(['missing', 'invalid'])('retains an SDK signature rejection for %s credentials', async (signature) => {
  const denied = new Response('invalid signature', { status: 401 });
  sdk.POST.mockResolvedValue(denied);
  const headers = signature === 'missing' ? {} : { 'x-inngest-signature': 'invalid' };
  expect(await POST(request('{}', headers), undefined)).toBe(denied);
  expect(sdk.POST).toHaveBeenCalledTimes(1);
});

it.each([POST, PUT])('rejects actual oversized bodies without a length header before SDK parsing', async (handler) => {
  const { req, cancel } = streamed([new Uint8Array(LIMIT), new Uint8Array(1), new Uint8Array(100)]);
  expect((await handler(req, undefined)).status).toBe(413);
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(sdk.POST).not.toHaveBeenCalled();
  expect(sdk.PUT).not.toHaveBeenCalled();
});

it('does not trust an understated length header to bypass the actual byte limit', async () => {
  const { req } = streamed([new Uint8Array(LIMIT), new Uint8Array(1)], { 'content-length': '1' });
  expect((await POST(req, undefined)).status).toBe(413);
  expect(sdk.POST).not.toHaveBeenCalled();
});

it('rejects an advertised oversized body without reading it', async () => {
  const req = request('{}', { 'content-length': String(LIMIT + 1) });
  const reader = jest.spyOn(req.body!, 'getReader');
  expect((await POST(req, undefined)).status).toBe(413);
  expect(reader).not.toHaveBeenCalled();
  expect(sdk.POST).not.toHaveBeenCalled();
});

it.each(['', '-1', '+1', '1.5', '1e3', 'NaN', '2, 2'])('rejects invalid Content-Length: %s', async (length) => {
  expect((await PUT(request('{}', { 'content-length': length }, 'PUT'), undefined)).status).toBe(400);
  expect(sdk.PUT).not.toHaveBeenCalled();
});

it.each(['0', '1', '3'])('rejects a Content-Length that disagrees with actual bytes: %s', async (length) => {
  expect((await POST(request('{}', { 'content-length': length }), undefined)).status).toBe(400);
  expect(sdk.POST).not.toHaveBeenCalled();
});

it('counts UTF-8 bytes instead of string characters', async () => {
  const req = request('éé');
  await expect(readBoundedRequestBody(req, 3)).rejects.toMatchObject({ status: 413 });
});

it('accepts bodies exactly at the limit and reconstructs readable bytes', async () => {
  // One large valid JSON string proves the byte boundary independently of the
  // separate collection/depth budget.
  const bytes = encoder.encode(JSON.stringify(' '.repeat(LIMIT - 2)));
  sdk.POST.mockImplementation(async (forwarded: NextRequest) => {
    const forwardedBytes = Buffer.from(await forwarded.arrayBuffer());
    expect(forwardedBytes.equals(Buffer.from(bytes))).toBe(true);
    return new Response('accepted');
  });
  expect((await POST(request(bytes, { 'content-length': String(LIMIT) }), undefined)).status).toBe(200);
});

it.each([POST, PUT])('rejects oversized collections before the SDK can amplify validation errors', async (handler) => {
  const body = JSON.stringify({ events: Array(10000).fill({ invalid: true }) });
  expect(encoder.encode(body).byteLength).toBeLessThan(LIMIT);
  expect((await handler(request(body, {}, handler === PUT ? 'PUT' : 'POST'), undefined)).status).toBe(413);
  expect(sdk.POST).not.toHaveBeenCalled();
  expect(sdk.PUT).not.toHaveBeenCalled();
});

it('rejects deeply nested JSON before invoking the SDK', async () => {
  const body = '{"child":'.repeat(31) + 'null' + '}'.repeat(31);
  expect((await POST(request(body), undefined)).status).toBe(413);
  expect(sdk.POST).not.toHaveBeenCalled();
});

it('rejects excessive aggregate nodes even when every collection is small', async () => {
  const body = JSON.stringify({ events: Array.from({ length: 6 }, () => Array(900).fill(null)) });
  expect((await POST(request(body), undefined)).status).toBe(413);
  expect(sdk.POST).not.toHaveBeenCalled();
});

it.each(['{', '   ', new Uint8Array([34, 0xff, 34])])('rejects malformed JSON or UTF-8 before invoking the SDK', async (body) => {
  expect((await POST(request(body), undefined)).status).toBe(400);
  expect(sdk.POST).not.toHaveBeenCalled();
});

it('allows empty PUT registration requests with a zero length', async () => {
  expect((await PUT(request(undefined, { 'content-length': '0' }, 'PUT'), undefined)).status).toBe(200);
  const forwarded = sdk.PUT.mock.calls[0][0] as NextRequest;
  expect(forwarded.method).toBe('PUT');
  expect(await forwarded.text()).toBe('');
});

it('rejects truncated or failed streams without invoking the SDK', async () => {
  const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.error(new Error('connection closed')); } });
  expect((await POST(request(stream), undefined)).status).toBe(400);
  expect(sdk.POST).not.toHaveBeenCalled();
});

it('leaves GET discovery unchanged', async () => {
  const req = request(undefined, { 'content-length': 'invalid' }, 'GET');
  const expected = new Response('discovery');
  sdk.GET.mockResolvedValue(expected);
  expect(await GET(req, undefined)).toBe(expected);
  expect(sdk.GET).toHaveBeenCalledWith(req, undefined);
});

describe('bounded JSON for public APIs', () => {
  it('parses valid JSON streamed across chunk boundaries', async () => {
    const { req } = streamed([encoder.encode('{"name":'), encoder.encode('"Zoë"}')]);
    await expect(readBoundedJson(req)).resolves.toEqual({ name: 'Zoë' });
  });

  it('enforces the default 16 KiB cap without a length header', async () => {
    const { req, cancel } = streamed([encoder.encode('"'), new Uint8Array(16 * 1024).fill(32), encoder.encode('"')]);
    await expect(readBoundedJson(req)).rejects.toMatchObject({ status: 413 });
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('accepts exact custom bounds and refuses the next byte', async () => {
    await expect(readBoundedJson(request('{}'), 2)).resolves.toEqual({});
    await expect(readBoundedJson(request('{}'), 1)).rejects.toMatchObject({ status: 413 });
  });

  it.each(['', '{', 'undefined'])('rejects malformed JSON with a typed client error: %s', async (body) => {
    const error = await readBoundedJson(request(body)).catch(error => error);
    expect(error).toBeInstanceOf(BodyLimitError);
    expect(error.status).toBe(400);
    expect(error.message).toBe('Invalid JSON request body');
  });

  it('rejects malformed UTF-8 instead of silently replacing bytes', async () => {
    await expect(readBoundedJson(request(new Uint8Array([34, 0xff, 34])))).rejects.toMatchObject({ status: 400 });
  });

  it('retains length-validation errors before JSON parsing', async () => {
    await expect(readBoundedJson(request('{}', { 'content-length': 'invalid' }))).rejects.toMatchObject({ status: 400, message: 'Invalid Content-Length' });
  });
});

describe('real Inngest SDK with hosting-adapter Request objects', () => {
  const { Inngest } = jest.requireActual('inngest');
  const { serve: actualServe } = jest.requireActual('inngest/next');
  const { Request: ProviderRequest } = jest.requireActual('next/dist/compiled/@edge-runtime/primitives/fetch');
  const canonicalize = jest.requireActual('canonicalize');
  const network = jest.fn(async () => { throw new Error('External calls are forbidden in this test'); });
  const client = new Inngest({ id: 'body-limit-tests', isDev: false, fetch: network });
  const echo = client.createFunction({ id: 'echo' }, { event: 'test/echo' }, async ({ event }: any) => ({ echo: event.data.message }));
  const realSdk = actualServe({ client, functions: [echo], signingKey, streaming: 'allow' });

  function adapterRequest(method: string, value: unknown, signed = false, extraHeaders: Record<string, string> = {}, query = '') {
    const headers: Record<string, string> = { 'content-type': 'application/json', ...extraHeaders };
    if (signed) {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = createHmac('sha256', signingKey.replace(/^signkey-\w+-/, ''))
        .update(canonicalize(value) + timestamp).digest('hex');
      headers['x-inngest-signature'] = `t=${timestamp}&s=${signature}`;
    }
    return new ProviderRequest(`http://localhost/api/inngest${query}`, { method, headers, body: JSON.stringify(value) });
  }

  beforeEach(() => {
    sdk.POST.mockImplementation((...args: any[]) => realSdk.POST(...args));
    sdk.PUT.mockImplementation((...args: any[]) => realSdk.PUT(...args));
  });

  afterEach(() => { expect(network).not.toHaveBeenCalled(); });

  it.each(['POST', 'PUT'])('reproduces the old constructor failure for a provider %s request', async (method) => {
    const req = adapterRequest(method, {});
    expect(req).not.toBeInstanceOf(Request);
    const body = await req.arrayBuffer();
    expect(() => new NextRequest(req, { body })).toThrow('Request with GET/HEAD method cannot have body');
  });

  it.each(['POST', 'PUT'])('preserves real SDK authentication for an unsigned provider %s request', async (method) => {
    // In-band registration rejects unsigned PUT locally; out-of-band PUT would
    // contact Inngest's registration API, which is intentionally forbidden here.
    const headers = method === 'PUT' ? { 'x-inngest-sync-kind': 'in_band' } : {};
    const baseline = await realSdk[method](adapterRequest(method, {}, false, headers), undefined);
    const wrapped = await (method === 'POST' ? POST : PUT)(adapterRequest(method, {}, false, headers), undefined);
    expect(baseline.status).toBe(401);
    expect(wrapped.status).toBe(baseline.status);
    expect(await wrapped.json()).toEqual(await baseline.json());
  });

  it('accepts the signed trust probe without executing a function or contacting a service', async () => {
    const baseline = await realSdk.POST(adapterRequest('POST', {}, true, {}, '?probe=trust'), undefined);
    const wrapped = await POST(adapterRequest('POST', {}, true, {}, '?probe=trust'), undefined);
    expect(baseline.status).toBe(200);
    expect(wrapped.status).toBe(baseline.status);
    expect(await wrapped.text()).toBe('');
    expect(await baseline.text()).toBe('');
  });

  it('passes a valid signed provider PUT through real SDK in-band registration', async () => {
    const value = { url: 'http://localhost/api/inngest' };
    const headers = { 'x-inngest-sync-kind': 'in_band' };
    const baseline = await realSdk.PUT(adapterRequest('PUT', value, true, headers), undefined);
    const wrapped = await PUT(adapterRequest('PUT', value, true, headers), undefined);
    expect(baseline.status).toBe(200);
    expect(wrapped.status).toBe(baseline.status);
    const result = await wrapped.json();
    expect(result.inspection.authentication_succeeded).toBe(true);
    expect(result.functions).toHaveLength(1);
    expect(result.functions[0].id).toBe('body-limit-tests-echo');
  });

  it('executes a valid signed provider POST using the real SDK and a provider-free function', async () => {
    const value = {
      version: 1, event: { name: 'test/echo', data: { message: 'Zoë 🌟' } }, events: [], steps: {},
      ctx: { run_id: 'test-run', attempt: 0, disable_immediate_execution: false, use_api: false },
    };
    const query = '?fnId=body-limit-tests-echo&stepId=step';
    const baseline = await realSdk.POST(adapterRequest('POST', value, true, {}, query), undefined);
    const wrapped = await POST(adapterRequest('POST', value, true, {}, query), undefined);
    expect(baseline.status).toBe(200);
    expect(wrapped.status).toBe(baseline.status);
    expect(await wrapped.json()).toEqual({ echo: 'Zoë 🌟' });
    expect(await baseline.json()).toEqual({ echo: 'Zoë 🌟' });
  });

  it('rejects a validly signed overwide event batch before real SDK validation', async () => {
    const value = { version: 1, events: Array(10000).fill(null), steps: {}, ctx: {} };
    const response = await POST(adapterRequest('POST', value, true), undefined);
    expect(response.status).toBe(413);
    expect(sdk.POST).not.toHaveBeenCalled();
  });

  it('preserves real SDK rejection of a signed but invalid registration body', async () => {
    const headers = { 'x-inngest-sync-kind': 'in_band' };
    const baseline = await realSdk.PUT(adapterRequest('PUT', {}, true, headers), undefined);
    const wrapped = await PUT(adapterRequest('PUT', {}, true, headers), undefined);
    expect(baseline.status).toBe(400);
    expect(wrapped.status).toBe(baseline.status);
    expect((await wrapped.json()).code).toBe('invalid_request');
  });
});
