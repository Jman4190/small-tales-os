import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { loadProfile, childEnvironment, writeLocalFontMock } from './start-isolated-test.mjs';

const require = createRequire(import.meta.url);
const fixtures = require('./isolated-providers.cjs');
const profileValues = {
  ISOLATED_TEST_PROJECT_REF: 'aaaaaaaaaaaaaaaaaaaa',
  NEXT_PUBLIC_SUPABASE_URL: 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${'b'.repeat(35)}`,
  SUPABASE_SECRET_KEY: `sb_secret_${'s'.repeat(35)}`,
  STRIPE_SECRET_KEY: `rkcs_test_${'t'.repeat(35)}`,
};

test('isolated profile rejects masked/live credentials and keeps one private internal secret', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'small-tales-isolated-profile-'));
  const profilePath = path.join(directory, 'profile.env');
  const write = (values) => fs.writeFileSync(profilePath, Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n'), { mode: 0o600 });
  try {
    write(profileValues);
    const first = loadProfile(profilePath).profile;
    assert.equal(loadProfile(profilePath).profile.INTERNAL_API_SECRET, first.INTERNAL_API_SECRET);
    assert.equal(fs.statSync(`${profilePath}.internal-secret`).mode & 0o777, 0o600);
    write({ ...profileValues, SUPABASE_SECRET_KEY: 'sb_secret_*****' });
    assert.throws(() => loadProfile(profilePath), /complete, unmasked/);
    write({ ...profileValues, STRIPE_SECRET_KEY: `sk_live_${'x'.repeat(35)}` });
    assert.throws(() => loadProfile(profilePath), /live keys are rejected/);
    write({ ...profileValues, ISOLATED_TEST_PROJECT_REF: 'bbbbbbbbbbbbbbbbbbbb' });
    assert.throws(() => loadProfile(profilePath), /matching HTTPS/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('child environment clears inherited provider credentials and forces local origins', () => {
  const previous = process.env.SLACK_BOT_TOKEN;
  process.env.SLACK_BOT_TOKEN = 'must-not-be-inherited';
  try {
    const env = childEnvironment({ ...profileValues, INTERNAL_API_SECRET: 'i'.repeat(64), CREATE_BOOK_SLACK_WEBHOOK_URL: 'must-not-be-copied', NEXT_PUBLIC_POSTHOG_KEY: 'must-not-be-copied' });
    assert.equal(env.SLACK_BOT_TOKEN, '');
    assert.equal(env.CREATE_BOOK_SLACK_WEBHOOK_URL, '');
    assert.equal(env.NEXT_PUBLIC_POSTHOG_KEY, '');
    assert.equal(env.TWILIO_PHONE_NUMBER, '');
    assert.equal(env.NEXT_PUBLIC_SUPABASE_ANON_KEY, '');
    assert.equal(env.INNGEST_DEV, '1');
    assert.equal(env.INNGEST_EVENT_API_BASE_URL, 'http://localhost:8289');
    assert.equal(env.NEXT_PUBLIC_APP_URL, 'http://localhost:3015');
    assert.equal(env.STRIPE_SECRET_KEY, profileValues.STRIPE_SECRET_KEY);
    assert.equal(env.FAL_KEY, 'isolated-inert-token');
  } finally {
    if (previous === undefined) delete process.env.SLACK_BOT_TOKEN;
    else process.env.SLACK_BOT_TOKEN = previous;
  }
});

test('synthetic assets are complete PNG and one-page PDF files', () => {
  const png = fixtures.syntheticPng(), pdf = fixtures.syntheticPdf().toString();
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), 512);
  assert.equal(png.readUInt32BE(20), 512);
  assert.ok(pdf.startsWith('%PDF-1.4\n'));
  assert.match(pdf, /\/Count 1/);
  const xrefOffset = Number(pdf.match(/startxref\n(\d+)/)[1]);
  assert.equal(pdf.slice(xrefOffset, xrefOffset + 4), 'xref');
});

test('Next font loader accepts local system-font declarations without a download', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'small-tales-isolated-font-'));
  try {
    const mock = require(writeLocalFontMock(directory));
    const postcss = require('postcss');
    const plugin = require('next/dist/build/webpack/loaders/next-font-loader/postcss-next-font').default;
    for (const family of ['Poppins', 'Manrope', 'Pacifico']) {
      const css = mock[`https://fonts.googleapis.com/css2?family=${family}:wght@400&display=swap`];
      const exports = [];
      const result = await postcss([plugin({ exports, fallbackFonts: ['Arial'], variable: '--font-test' })]).process(css, { from: undefined });
      assert.match(result.css, /local\('Arial'\)/);
      assert.ok(exports.length > 0);
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('preload diagnostics preserve TypeScript machine-readable stdout', () => {
  const child = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--showConfig'], {
    cwd: path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'),
    env: childEnvironment({ ...profileValues, INTERNAL_API_SECRET: 'i'.repeat(64) }),
    encoding: 'utf8', timeout: 10000,
  });
  assert.equal(child.status, 0, child.stderr);
  assert.ok(JSON.parse(child.stdout).compilerOptions);
  assert.match(child.stderr, /fixtures.enabled/);
});

test('actual Fal SDK and all paid-provider fixtures work offline; unknown destinations fail closed', async () => {
  const realFetch = globalThis.fetch;
  const forwarded = [];
  globalThis.fetch = async (input) => { forwarded.push(String(input)); return new Response('{}', { headers: { 'Content-Type': 'application/json' } }); };
  fixtures.installProviderFixtures({ ...profileValues, NODE_ENV: 'development', NEXT_PUBLIC_APP_URL: 'http://localhost:3015', ISOLATED_TEST_PROVIDERS: '1', INNGEST_DEV: '1' });
  try {
    const { fal } = require('@fal-ai/client');
    fal.config({ credentials: 'isolated-inert-token', fetch: globalThis.fetch });
    const fileUrl = await fal.storage.upload(new File([fixtures.syntheticPng()], 'synthetic.png', { type: 'image/png' }));
    const verified = await fal.subscribe('fal-ai/bagel/understand', { input: { image_url: fileUrl, prompt: 'explicit synthetic fixture' }, logs: false });
    assert.equal(JSON.parse(verified.data.text).passes, true);
    const rejected = await fetch('https://queue.fal.run/fal-ai/bagel/understand', { method: 'POST', body: JSON.stringify({ image_url: 'https://not-synthetic.invalid/photo.jpg' }) });
    assert.equal(rejected.status, 422);
    const init = await (await fetch('https://cloud.leonardo.ai/api/rest/v1/init-image', { method: 'POST' })).json();
    assert.equal((await fetch(init.uploadInitImage.url, { method: 'POST', body: new FormData() })).status, 204);
    const generation = await (await fetch('https://cloud.leonardo.ai/api/rest/v1/generations', { method: 'POST' })).json();
    const result = await (await fetch(`https://cloud.leonardo.ai/api/rest/v1/generations/${generation.sdGenerationJob.generationId}`)).json();
    assert.equal(result.generations_by_pk.status, 'COMPLETE');
    assert.match(result.generations_by_pk.generated_images[0].url, /aaaaaaaaaaaaaaaaaaaa\.supabase\.co/);
    assert.match((await (await fetch('https://pdf-api.io/api/templates/isolated/pdf', { method: 'POST' })).json()).url, /fixture\.pdf$/);
    assert.equal((await (await fetch('https://api.cloudflare.com/client/v4/accounts/isolated/email/sending/send', { method: 'POST' })).json()).success, true);
    assert.equal((await fetch('https://order.gelatoapis.com/v4/orders', { method: 'POST', body: JSON.stringify({ items: [{ files: [{ url: 'pdfs/orders/relative.pdf' }] }] }) })).status, 422);
    const signedPdf = profileValues.NEXT_PUBLIC_SUPABASE_URL + '/storage/v1/object/sign/book-photos/pdfs/orders/synthetic/generated.pdf?token=synthetic-fixture-token';
    assert.equal((await (await fetch('https://order.gelatoapis.com/v4/orders', { method: 'POST', body: JSON.stringify({ items: [{ files: [{ url: signedPdf }] }] }) })).json()).simulated, true);
    assert.equal((await fetch('https://registry.npmjs.org/-/package/next/dist-tags')).status, 503);
    assert.equal((await fetch('https://registry.npmjs.org/-/npm/v1/security/advisories/bulk', { method: 'POST' })).status, 503);
    assert.equal(forwarded.length, 0);
    await fetch('https://aaaaaaaaaaaaaaaaaaaa.supabase.co/rest/v1/books');
    assert.equal(forwarded.length, 1);
    await assert.rejects(fetch('https://production-project.supabase.co/rest/v1/books'), /blocked an unapproved/);
    await assert.rejects(fetch('https://hooks.slack.com/services/nope'), /blocked an unapproved/);
    assert.throws(() => require('node:https').request('https://api.twilio.com/'), /blocked an unapproved/);
  } finally { globalThis.fetch = realFetch; }
});
