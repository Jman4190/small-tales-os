#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { applySecurityPatches } from './patch-security-dependencies.mjs';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { syntheticPng, syntheticPdf } = require('./isolated-providers.cjs');
const isWithin = (file, directory) => file === directory || file.startsWith(`${directory}${path.sep}`);
const readEnv = (file) => fs.existsSync(file) ? parseEnv(fs.readFileSync(file, 'utf8')) : {};
const validKey = (value) => typeof value === 'string' && value.length >= 35 && !/\*|•|…|\.\.\.|your_|placeholder/i.test(value);

export function loadProfile(profilePath) {
  if (!profilePath || !path.isAbsolute(profilePath)) throw new Error('Supply an absolute path to a private test profile outside the repository.');
  const real = fs.realpathSync(profilePath);
  if (isWithin(real, fs.realpathSync(root))) throw new Error('The test profile must stay outside the repository.');
  if (!fs.statSync(real).isFile() || (fs.statSync(real).mode & 0o077)) throw new Error('The test profile must be a regular private file; run chmod 600 on it.');
  const profile = readEnv(real);
  const ref = profile.ISOLATED_TEST_PROJECT_REF;
  const url = new URL(profile.NEXT_PUBLIC_SUPABASE_URL || 'invalid:');
  if (!/^[a-z0-9]{20}$/.test(ref || '') || url.protocol !== 'https:' || url.hostname !== `${ref}.supabase.co` || url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Set an explicit test project ref and its matching HTTPS Supabase URL.');
  const main = readEnv(path.join(root, '.env.local'));
  if (main.NEXT_PUBLIC_SUPABASE_URL && new URL(main.NEXT_PUBLIC_SUPABASE_URL).hostname === url.hostname) throw new Error('The isolated project must differ from the main .env.local project.');
  const browserKey = profile.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || profile.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = profile.SUPABASE_SECRET_KEY || profile.SUPABASE_SERVICE_ROLE_KEY;
  if (!validKey(browserKey) || !validKey(secretKey) || secretKey === browserKey) throw new Error('Provide complete, unmasked and distinct Supabase browser/server test keys.');
  if (secretKey === main.SUPABASE_SECRET_KEY || secretKey === main.SUPABASE_SERVICE_ROLE_KEY) throw new Error('The isolated service key must differ from the main environment.');
  if (!/^(?:sk|rk|rkcs)_test_[A-Za-z0-9]{12,}$/.test(profile.STRIPE_SECRET_KEY || '')) throw new Error('Use a complete Stripe test or Sandbox secret/restricted key; live keys are rejected.');
  let internalSecret = profile.INTERNAL_API_SECRET;
  const secretFile = `${real}.internal-secret`;
  if (!internalSecret) {
    if (!fs.existsSync(secretFile)) fs.writeFileSync(secretFile, `${randomBytes(32).toString('hex')}\n`, { mode: 0o600, flag: 'wx' });
    if (fs.statSync(secretFile).mode & 0o077) throw new Error('The isolated internal-secret file must have mode 600.');
    internalSecret = fs.readFileSync(secretFile, 'utf8').trim();
  }
  if (!internalSecret || internalSecret.length < 32 || internalSecret === main.INTERNAL_API_SECRET) throw new Error('Use a stable random test-only INTERNAL_API_SECRET, distinct from the main environment.');
  return { path: real, profile: { ...profile, NEXT_PUBLIC_SUPABASE_URL: url.origin, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: browserKey, SUPABASE_SECRET_KEY: secretKey, INTERNAL_API_SECRET: internalSecret } };
}

function sourceEnvironmentKeys(directory) {
  const keys = new Set();
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || ['node_modules', 'public', 'small-tales-course'].includes(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) for (const key of sourceEnvironmentKeys(file)) keys.add(key);
    else if (/\.(?:ts|tsx|js|mjs|cjs)$/.test(file)) for (const match of fs.readFileSync(file, 'utf8').matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) keys.add(match[1]);
  }
  return keys;
}

export function childEnvironment(profile) {
  const env = {};
  for (const key of ['PATH', 'HOME', 'TMPDIR', 'TEMP', 'TMP', 'SystemRoot', 'COMSPEC', 'LANG', 'LC_ALL', 'TERM']) if (process.env[key]) env[key] = process.env[key];
  const cleared = sourceEnvironmentKeys(root);
  for (const file of ['.env.example', '.env', '.env.local', '.env.development', '.env.development.local']) for (const key of Object.keys(readEnv(path.join(root, file)))) cleared.add(key);
  for (const key of Object.keys(process.env)) if (/^(NEXT_PUBLIC_|SUPABASE_|STRIPE_|INNGEST_|LEONARDO_|FAL_|PDF_|GELATO_|CLOUDFLARE_|RESEND_|TWILIO_|SLACK_|FACEBOOK_|LOGTAIL_|EMAIL_|ADMIN_|INTERNAL_|VERIFY_|CREATE_|PREVIEW_|BOOK_)/.test(key)) cleared.add(key);
  for (const key of cleared) env[key] = '';
  for (const key of ['ISOLATED_TEST_PROJECT_REF', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'INTERNAL_API_SECRET', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_ID', 'STRIPE_TAX_RATE_ID', 'STRIPE_SHIPPING_RATE_ID', 'STRIPE_PAYMENT_METHOD_CONFIGURATION_ID']) env[key] = profile[key] || '';
  Object.assign(env, {
    NODE_ENV: 'development', NEXT_PUBLIC_APP_URL: 'http://localhost:3015', NEXT_PUBLIC_BASE_URL: 'http://localhost:3015', PORT: '3015',
    INNGEST_DEV: '1', INNGEST_BASE_URL: 'http://localhost:8289', INNGEST_DEVSERVER_URL: 'http://localhost:8289', INNGEST_EVENT_API_BASE_URL: 'http://localhost:8289', INNGEST_API_BASE_URL: 'http://localhost:8289', INNGEST_EVENT_KEY: 'isolated-local-events',
    ISOLATED_TEST_PROVIDERS: '1', ISOLATED_TEST_DIAGNOSE_STARTUP: '1', NEXT_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1', INNGEST_NO_TELEMETRY: '1',
    EMAIL_PROVIDER: 'cloudflare', CLOUDFLARE_ACCOUNT_ID: '00000000000000000000000000000000', CLOUDFLARE_EMAIL_API_TOKEN: 'isolated-inert-token', ADMIN_NOTIFICATION_EMAIL: 'isolated-admin@example.invalid',
    LEONARDO_API_KEY: 'isolated-inert-token', FAL_KEY: 'isolated-inert-token', PDF_API_KEY: 'isolated-inert-token', PDF_TEMPLATE_ID: 'isolated-fixture', GELATO_API_KEY: 'isolated-inert-token', GELATO_WEBHOOK_SECRET_NONINNGEST: 'isolated-inert-webhook',
    TWILIO_ACCOUNT_SID: `AC${'0'.repeat(32)}`, TWILIO_API_KEY_SID: `SK${'0'.repeat(32)}`, TWILIO_API_KEY_SECRET: 'isolated-inert-token', TWILIO_AUTH_TOKEN: 'isolated-inert-token', TWILIO_PHONE_NUMBER: '',
    NODE_OPTIONS: `--require ${JSON.stringify(path.join(root, 'scripts/isolated-providers.cjs'))}`,
  });
  return env;
}

export function writeLocalFontMock(directory) {
  const file = path.join(directory, 'isolated-fonts.cjs');
  fs.writeFileSync(file, `module.exports = new Proxy({}, { get: (_, url) => {
    const match = String(url).match(/[?&]family=([^:&]+)/);
    const family = match ? decodeURIComponent(match[1]).replace(/\\+/g, ' ').replace(/[^A-Za-z ]/g, '') : 'Isolated Font';
    return "@font-face { font-family: '" + family + "'; src: local('Arial'); font-style: normal; font-weight: 100 900; font-display: swap; }";
  } });\n`, { mode: 0o600 });
  return file;
}

async function assertPortFree(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error(`Local port ${port} is in use; stop the old test process first.`)));
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}

async function seedFixtures(profile, directory) {
  const headers = { apikey: profile.SUPABASE_SECRET_KEY, ...(profile.SUPABASE_SECRET_KEY.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${profile.SUPABASE_SECRET_KEY}` }), 'x-upsert': 'true' };
  const png = syntheticPng(), pdf = syntheticPdf();
  const references = ['page_1_kid_running', 'page_2_racecar_driver', 'page_3_baker', 'page_4_olympic_sprinter', 'page_5_astronaut', 'page_6_surfer', 'page_7_rockstar', 'page_8_firefighter', 'page_9_pilot', 'page_10_scientist', 'page_11_student'];
  const objects = [
    ['review-media/isolated/fixture.png', png, 'image/png'], ['review-media/isolated/fixture.pdf', pdf, 'application/pdf'],
    ['book-photos/cover_image/cover-image-small-tales.jpg', png, 'image/png'],
    ...references.map((reference) => [`book-photos/book_images/${reference}.jpg`, png, 'image/png']),
  ];
  for (const [object, body, contentType] of objects) {
    const response = await fetch(`${profile.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${object}`, { method: 'POST', headers: { ...headers, 'Content-Type': contentType }, body, redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Could not seed the isolated fixture storage (HTTP ${response.status}). Check the test schema, buckets and complete server key.`);
  }
  fs.writeFileSync(path.join(directory, 'synthetic-book.png'), png, { mode: 0o600 });
  fs.writeFileSync(path.join(directory, 'synthetic-preview.pdf'), pdf, { mode: 0o600 });
  process.stdout.write('Seeded synthetic reference artwork and one-page PDF in the isolated project.\n');
}

export async function main(argv = process.argv.slice(2)) {
  const [profilePath, option] = argv;
  if (!profilePath || argv.length > 2 || (option && !['--check', '--preview-only'].includes(option))) throw new Error('Usage: node scripts/start-isolated-test.mjs /absolute/private/profile.env [--check|--preview-only]');
  applySecurityPatches(root, { check: true });
  const { path: realProfile, profile } = loadProfile(profilePath);
  const env = childEnvironment(profile);
  if (option === '--check') { process.stdout.write('Isolated profile validated; no network calls or services started.\n'); return; }
  if (option !== '--preview-only') for (const key of ['STRIPE_PRICE_ID', 'STRIPE_TAX_RATE_ID', 'STRIPE_SHIPPING_RATE_ID', 'STRIPE_PAYMENT_METHOD_CONFIGURATION_ID', 'STRIPE_WEBHOOK_SECRET']) if (!profile[key]) throw new Error(`Complete ${key} in the private Stripe Sandbox profile before starting, or use --preview-only to test uploads and generation.`);
  await assertPortFree(3015); await assertPortFree(8289);
  const cli = path.join(root, 'node_modules/inngest-cli/bin/inngest');
  if (!fs.existsSync(cli)) throw new Error('The pinned local Inngest CLI is missing. Run npm ci first.');
  const directory = path.dirname(realProfile);
  // Empty local font-face declarations select system fonts without downloading
  // Google assets. This documented Next test hook does not alter app sources.
  env.NEXT_FONT_GOOGLE_MOCKED_RESPONSES = writeLocalFontMock(directory);
  await seedFixtures(profile, directory);
  const children = new Set();
  let stopping = false;
  function stop(code = 0) {
    if (stopping) return;
    stopping = true;
    for (const child of children) child.kill('SIGTERM');
    const timeout = setTimeout(() => { for (const child of children) child.kill('SIGKILL'); process.exit(code); }, 5000);
    timeout.unref();
    process.exitCode = code;
  }
  function start(command, args) {
    const child = spawn(command, args, { cwd: root, env, stdio: 'inherit' });
    children.add(child);
    child.once('error', () => { process.stderr.write('An isolated test process could not start.\n'); stop(1); });
    child.once('exit', (code) => { children.delete(child); if (!stopping) stop(code || 1); });
    return child;
  }
  process.once('SIGINT', () => stop()); process.once('SIGTERM', () => stop());
  start(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '3015']);
  start(cli, ['dev', '--no-discovery', '--host', '127.0.0.1', '--port', '8289', '-u', 'http://localhost:3015/api/inngest']);
  process.stdout.write('Isolated app: http://localhost:3015\nLocal worker: http://localhost:8289\nPaid AI, PDF, email and print providers are simulated. Stripe test checkout and isolated Supabase are real.\nUse the synthetic-book.png beside the private profile for uploads; never use real child/customer data.\n');
  if (option === '--preview-only') process.stdout.write('PREVIEW-ONLY MODE: Checkout resources are not verified. Payment testing is not ready.\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : 'Isolated test setup failed.'}\n`); process.exitCode = 1; });
}
