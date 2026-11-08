'use strict';

// Local development fixture only. The launcher enables this preload explicitly;
// production routes and deployed bundles never import it.
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const http = require('node:http');
const https = require('node:https');

function syntheticPng() {
  const width = 512, height = 512;
  const pixels = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    for (let x = 0; x < width; x++) {
      let rgb = [230, 239, 235];
      if (x > 105 && x < 407 && y > 90 && y < 415) rgb = [80, 123, 113];
      if (x > 130 && x < 380 && y > 115 && y < 385) rgb = [250, 246, 229];
      if (x > 160 && x < 352 && ((y > 170 && y < 185) || (y > 220 && y < 235) || (y > 270 && y < 285))) rgb = [80, 123, 113];
      pixels.set(rgb, row + 1 + x * 3);
    }
  }
  function chunk(type, data) {
    const label = Buffer.from(type), length = Buffer.alloc(4), checksum = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    let crc = 0xffffffff;
    for (const value of Buffer.concat([label, data])) {
      crc ^= value;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([length, label, data, checksum]);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}

function syntheticPdf() {
  const content = 'BT /F1 18 Tf 72 700 Td (Isolated test fixture - no printing or delivery) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

function installProviderFixtures(env = process.env) {
  if (env.ISOLATED_TEST_PROVIDERS !== '1' || env.INNGEST_DEV !== '1' || env.NODE_ENV === 'production' || env.NEXT_PUBLIC_APP_URL !== 'http://localhost:3015') {
    throw new Error('Provider fixtures require the isolated local test launcher.');
  }
  const testHost = `${env.ISOLATED_TEST_PROJECT_REF}.supabase.co`;
  const supabase = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
  if (!/^[a-z0-9]{20}$/.test(env.ISOLATED_TEST_PROJECT_REF || '') || supabase.protocol !== 'https:' || supabase.hostname !== testHost) {
    throw new Error('Provider fixtures require an explicitly matched test project.');
  }
  const imageUrl = `${supabase.origin}/storage/v1/object/public/review-media/isolated/fixture.png`;
  const pdfUrl = `${supabase.origin}/storage/v1/object/public/review-media/isolated/fixture.pdf`;
  const fakeOrigin = 'https://isolated-provider.invalid';
  const fakeFalImage = `${fakeOrigin}/fal/synthetic.png`;
  const originalFetch = globalThis.fetch;
  const originalHttp = { request: http.request, get: http.get };
  const originalHttps = { request: https.request, get: https.get };
  const installed = Symbol.for('small-tales.isolated-provider-fixtures');
  if (globalThis[installed]) return;
  globalThis[installed] = true;
  // Compiler subprocesses reserve stdout for machine-readable JSON.
  const event = (type) => process.stderr.write(`[isolated-provider] ${type}\n`);
  // Observe without replacing Next's error handlers. Never print exception
  // messages, stacks, or request data: only fixed local diagnostic categories.
  if (env.ISOLATED_TEST_DIAGNOSE_STARTUP === '1') {
    process.on('uncaughtExceptionMonitor', (error) => {
      const message = typeof error?.message === 'string' ? error.message : '';
      const stack = typeof error?.stack === 'string' ? error.stack : '';
      let category = 'unknown';
      if (/ECONNREFUSED/.test(message)) category = 'connection-refused';
      else if (/ENOTFOUND|EAI_AGAIN/.test(message)) category = 'dns-unavailable';
      else if (/Cannot redefine property|read only|not configurable/i.test(message)) category = 'property-redefinition';
      else if (/Invalid URL|absolute URL/i.test(message)) category = 'invalid-url';
      else if (/Cannot find module|MODULE_NOT_FOUND/i.test(message)) category = 'module-not-found';
      else if (/Loading chunk|Failed to load chunk|ChunkLoadError/i.test(message)) category = 'chunk-load';
      else if (/worker.*(?:exit|stop)|(?:exit|stop).*worker/i.test(message)) category = 'worker-exit';
      else if (/blocked an unapproved/.test(message)) category = 'network-guard';
      else if (/timeout|timed out/i.test(message)) category = 'timeout';
      const component = /opentelemetry/i.test(stack) ? 'instrumentation' : /inngest/i.test(stack) ? 'inngest' : /undici/i.test(stack) ? 'fetch' : /node_modules[\\/]next[\\/]/.test(stack) ? 'next' : 'runtime';
      event(`exception.${component}.${category}`);
    });
  }
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', 'x-fal-request-id': 'isolated-fal-request' } });
  function networkCategory(url) {
    if (!url) return 'unknown';
    if (url.hostname === 'registry.npmjs.org' && url.pathname === '/-/package/next/dist-tags') return 'next-version-check';
    if (url.hostname === 'registry.npmjs.org' && url.pathname === '/-/npm/v1/security/advisories/bulk') return 'next-advisory-check';
    if (url.hostname === 'registry.npmjs.org' && ['/next/latest', '/next/canary', '/next'].includes(url.pathname)) return 'next-package-metadata';
    if (url.hostname === 'registry.npmjs.org' && url.pathname.startsWith('/@next/swc-')) return 'next-compiler-package';
    if (url.hostname === 'registry.npmjs.org') return 'npm-registry';
    if (url.hostname === 'registry.yarnpkg.com') return 'yarn-registry';
    if (url.hostname === 'api.github.com') return 'github-api';
    if (url.hostname === 'api.vercel.com') return 'vercel-api';
    if (url.hostname === 'nextjs.org') return 'next-website';
    if (url.hostname.endsWith('.sentry.io')) return 'sdk-error-telemetry';
    if (url.hostname === 'telemetry.nextjs.org') return 'next-telemetry';
    if (['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) return 'google-font';
    if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return 'unapproved-local-port';
    if (url.hostname.endsWith('.supabase.co')) return 'unapproved-supabase';
    return 'unapproved-external';
  }
  const blocked = (url) => { event(`network.blocked.${networkCategory(url)}`); throw new Error('Isolated test blocked an unapproved network destination.'); };
  const allowed = (url) => (url.protocol === 'https:' && !url.port && [testHost, 'api.stripe.com'].includes(url.hostname)) ||
    (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && ['3015', '8289'].includes(url.port));

  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    const method = (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const readJson = async () => {
      try { return JSON.parse(typeof init.body === 'string' ? init.body : input instanceof Request ? await input.clone().text() : '{}'); }
      catch { return null; }
    };
    // Optional Next development metadata stays explicitly unavailable offline.
    // Never fabricate a current version or an empty security advisory result.
    if (url.protocol === 'https:' && url.hostname === 'registry.npmjs.org' &&
        ((url.pathname === '/-/package/next/dist-tags' && method === 'GET') ||
         (url.pathname === '/-/npm/v1/security/advisories/bulk' && method === 'POST'))) {
      event(url.pathname.endsWith('/dist-tags') ? 'next.version-check.offline' : 'next.advisory-check.offline');
      return json({ error: 'Automatic Next development metadata is unavailable in this isolated offline harness. Run the repository dependency audit separately.' }, 503);
    }
    if (url.origin === fakeOrigin) {
      if (/^\/leonardo-upload\/[a-f0-9-]+$/.test(url.pathname) && method === 'POST') { event('leonardo.upload'); return new Response(null, { status: 204 }); }
      if (url.pathname === '/fal-upload' && method === 'PUT') { event('fal.upload'); return json({}); }
      if (url.pathname === '/fal/synthetic.png' && method === 'GET') return new Response(syntheticPng(), { headers: { 'Content-Type': 'image/png' } });
      return blocked();
    }
    if (url.hostname === 'rest.fal.ai' && url.pathname === '/storage/upload/initiate' && method === 'POST') {
      event('fal.storage-init');
      return json({ upload_url: `${fakeOrigin}/fal-upload`, file_url: fakeFalImage });
    }
    if (url.hostname === 'queue.fal.run') {
      if (method === 'POST' && url.pathname === '/fal-ai/bagel/understand') {
        const body = await readJson();
        if (body?.image_url !== fakeFalImage) return json({ message: 'Only the explicit synthetic fixture namespace is supported.' }, 422);
        event('fal.verify-submit');
        return json({ request_id: 'isolated-fal-request', status: 'IN_QUEUE', response_url: 'https://queue.fal.run/fal-ai/bagel/requests/isolated-fal-request', status_url: 'https://queue.fal.run/fal-ai/bagel/requests/isolated-fal-request/status', cancel_url: 'https://queue.fal.run/fal-ai/bagel/requests/isolated-fal-request/cancel' });
      }
      if (method === 'GET' && url.pathname === '/fal-ai/bagel/requests/isolated-fal-request/status') return json({ status: 'COMPLETED', request_id: 'isolated-fal-request', logs: [] });
      if (method === 'GET' && url.pathname === '/fal-ai/bagel/requests/isolated-fal-request') {
        event('fal.verify-result');
        return json({ text: JSON.stringify({ passes: true, failureReason: null, appearance: { skinTone: 'synthetic fixture tone', hair: 'synthetic short hair', eyeColor: 'synthetic eyes' } }) });
      }
      return blocked();
    }
    if (url.hostname === 'cloud.leonardo.ai') {
      if (url.pathname === '/api/rest/v1/init-image' && method === 'POST') {
        event('leonardo.init'); const id = crypto.randomUUID();
        return json({ uploadInitImage: { id, url: `${fakeOrigin}/leonardo-upload/${id}`, fields: JSON.stringify({ key: 'isolated-synthetic' }) } });
      }
      if (url.pathname === '/api/rest/v1/generations' && method === 'POST') {
        event('leonardo.generate'); return json({ sdGenerationJob: { generationId: crypto.randomUUID() } });
      }
      if (/^\/api\/rest\/v1\/generations\/[a-f0-9-]+$/.test(url.pathname) && method === 'GET') {
        event('leonardo.complete'); return json({ generations_by_pk: { status: 'COMPLETE', generated_images: [{ id: crypto.randomUUID(), url: imageUrl }] } });
      }
      return blocked();
    }
    if (url.hostname === 'pdf-api.io' && /^\/api\/templates\/[^/]+\/pdf$/.test(url.pathname) && method === 'POST') {
      event('pdf.generate'); return json({ url: pdfUrl });
    }
    if (url.hostname === 'api.cloudflare.com' && /^\/client\/v4\/accounts\/[^/]+\/email\/sending\/send$/.test(url.pathname) && method === 'POST') {
      event('email.sink'); return json({ success: true, errors: [], result: { message_id: `isolated-email-${crypto.randomUUID()}`, delivered: [], queued: [], permanent_bounces: [] } });
    }
    if (url.hostname === 'order.gelatoapis.com' && url.pathname === '/v4/orders' && method === 'POST') {
      const body = await readJson();
      const files = body?.items?.flatMap((item) => item.files || []) || [];
      const validPdf = files.length > 0 && files.every((file) => {
        try {
          const target = new URL(file.url);
          return target.protocol === 'https:' && target.hostname === testHost &&
            target.pathname.startsWith('/storage/v1/object/sign/book-photos/') && !!target.searchParams.get('token');
        } catch { return false; }
      });
      if (!validPdf) { event('print.invalid-pdf'); return json({ error: 'Synthetic printing requires a signed PDF from the isolated test project.' }, 422); }
      event('print.simulated'); return json({ id: `isolated-print-${crypto.randomUUID()}`, status: 'created', simulated: true, estimatedShippingDate: null }, 201);
    }
    if (!allowed(url)) return blocked(url);
    // Prevent fetch redirects from silently escaping the allowlist.
    const response = await originalFetch(input, { ...init, redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) return blocked(url);
    return response;
  };

  // Stripe's Node SDK uses https.request rather than global fetch. Guard that
  // transport too; no third-party HTTP fallback may reach a paid provider.
  function guardNodeRequest(original, protocol, args) {
    const first = args[0]; const options = typeof first === 'object' && !(first instanceof URL) ? first : (args[1] && typeof args[1] === 'object' ? args[1] : {});
    const url = typeof first === 'string' || first instanceof URL ? new URL(first) : new URL(`${options.protocol || protocol}//${options.hostname || options.host || 'localhost'}${options.port ? `:${options.port}` : ''}${options.path || '/'}`);
    if (!allowed(url)) return blocked(url);
    return original(...args);
  }
  http.request = (...args) => guardNodeRequest(originalHttp.request, 'http:', args);
  http.get = (...args) => guardNodeRequest(originalHttp.get, 'http:', args);
  https.request = (...args) => guardNodeRequest(originalHttps.request, 'https:', args);
  https.get = (...args) => guardNodeRequest(originalHttps.get, 'https:', args);
  require('node:module').syncBuiltinESMExports();
  event('fixtures.enabled');
}

module.exports = { syntheticPng, syntheticPdf, installProviderFixtures };
if (process.env.ISOLATED_TEST_PROVIDERS === '1') installProviderFixtures();
