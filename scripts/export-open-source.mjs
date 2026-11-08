#!/usr/bin/env node
// Produce a reviewable code-only snapshot without copying repository history.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { neutralizePublicBranding } from './public-release-branding.mjs';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const [destinationArg, revision = 'HEAD'] = process.argv.slice(2);
if (!destinationArg || process.argv.length > 4) {
  throw new Error('Usage: node scripts/export-open-source.mjs /new/directory/outside/repo [commit|--worktree]');
}
const destination = path.resolve(destinationArg);
const preview = revision === '--worktree';
const commit = execFileSync('git', ['rev-parse', '--verify', `${preview ? 'HEAD' : revision}^{commit}`], { cwd: root, encoding: 'utf8' }).trim();
if (destination === root || destination.startsWith(`${root}${path.sep}`) || fs.existsSync(destination)) {
  throw new Error('Choose a new destination outside this repository. Existing directories are never overwritten.');
}
// Resolve the existing ancestor too, preventing a symlink from pointing into this repo.
let ancestor = path.dirname(destination);
while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
const realAncestor = fs.realpathSync(ancestor);
const realRoot = fs.realpathSync(root);
if (realAncestor === realRoot || realAncestor.startsWith(`${realRoot}${path.sep}`)) {
  throw new Error('Destination parent resolves inside the repository.');
}

const rootFiles = new Set([
  '.browserlistrc', '.gitattributes', '.gitignore', '.env.example', 'README.md',
  'LICENSE', 'SECURITY.md', 'CONTRIBUTING.md', 'THIRD_PARTY_NOTICES.md',
  'package.json', 'package-lock.json', 'components.json', 'env.d.ts', 'jest.config.ts',
  'middleware.ts', 'instrumentation.ts', 'next-env.d.ts', 'next.config.mjs', 'next-sitemap.config.js',
  'postcss.config.js', 'postcss.config.mjs', 'tailwind.config.js', 'tailwind.config.ts',
  'tsconfig.json', 'tsconfig.typecheck.json', 'setup.sh', 'vercel.json',
]);
const sourceDirectories = new Set(['app', 'components', 'config', 'hooks', 'inngest', 'lib', 'types', 'utils', '__tests__']);
const workerFiles = new Set(['public/pdf.worker.mjs', 'public/pdf.worker.min.mjs', 'public/pdf.worker.min.js']);
function allowed(file) {
  if (file.split('/').some((part) => part.startsWith('.') || part === 'node_modules')) return rootFiles.has(file);
  if (rootFiles.has(file) || workerFiles.has(file)) return true;
  if (file === 'scripts/patch-security-dependencies.mjs' || /^scripts\/security-patches\/[a-z0-9.-]+\.mjs$/.test(file) || file === 'docs/security-dependency-patches.md') return true;
  if (['scripts/export-open-source.mjs', 'scripts/public-release-branding.mjs', 'scripts/public-release-branding.test.mjs', 'scripts/check-database-schema.sh', 'scripts/start-isolated-test.mjs', 'scripts/isolated-providers.cjs', 'scripts/isolated-test.test.mjs', 'docs/open-source-release.md', 'docs/isolated-testing.md'].includes(file)) return true;
  if (file.startsWith('third-party/')) return /(?:LICENSE|NOTICE)[^/]*\.(?:txt|md)$/.test(path.basename(file));
  if (file.startsWith('database/')) return /\.(?:sql|md)$/.test(file);
  return sourceDirectories.has(file.split('/')[0]) && /\.(?:ts|tsx|js|mjs|json|css)$/.test(file);
}

const tree = execFileSync('git', ['ls-tree', '-r', '-z', commit], { cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
const entries = new Map(tree.split('\0').filter(Boolean).map((entry) => {
  const [metadata, file] = entry.split('\t');
  return [file, metadata.split(' ')[0]];
}));
if (preview) {
  const extra = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' });
  for (const file of extra.split('\0').filter(Boolean)) if (allowed(file)) entries.set(file, '100644');
}
const files = [...entries.keys()].filter(allowed).sort();
const output = new Map();
const transformations = [];
const originalMedia = [...entries.keys()].filter((file) => file.startsWith('public/') && /\.(?:png|jpe?g|avif|webp|gif|svg|ico|mp4|pdf)$/i.test(file));
const placeholder = '/release-placeholder.svg';
for (const file of files) {
  if (!['100644', '100755'].includes(entries.get(file))) throw new Error(`Refusing non-regular file: ${file}`);
  let bytes;
  if (preview) {
    const local = path.join(root, file);
    if (!fs.existsSync(local)) continue; // A tracked deletion is omitted from previews.
    if (!fs.lstatSync(local).isFile()) throw new Error(`Refusing non-regular file: ${file}`);
    const realFile = fs.realpathSync(local);
    if (!realFile.startsWith(`${realRoot}${path.sep}`)) throw new Error(`Refusing source outside the repository: ${file}`);
    bytes = fs.readFileSync(local);
  } else {
    bytes = execFileSync('git', ['show', `${commit}:${file}`], { cwd: root, maxBuffer: 25 * 1024 * 1024 });
  }
  if (!workerFiles.has(file) && file !== 'scripts/export-open-source.mjs' && file !== 'LICENSE' && !file.startsWith('third-party/')) {
    let text = bytes.toString('utf8');
    const before = text;
    // Domain replacement also covers email addresses and URLs in tests.
    text = neutralizePublicBranding(file, text).replace(/(?:smalltalesbooks|smalltales)\.com/gi, 'example.com');
    // The isolated harness contains explicit synthetic project refs whose URL
    // must keep matching that ref for its safety checks and offline tests.
    if (!file.startsWith('scripts/isolated-') && file !== 'scripts/start-isolated-test.mjs') {
      text = text.replace(/\b[a-z0-9-]+\.supabase\.co/g, 'your-project.supabase.co');
    }
    if (/^(?:app|components)\//.test(file)) {
      // Marketing video is omitted entirely; keep a visible, valid fallback.
      text = text.replace(/<video\b[\s\S]*?<\/video>/g, '<img src="/release-placeholder.svg" alt="Example media placeholder" className="w-full h-full object-cover" />');
      for (const media of originalMedia.sort((a, b) => b.length - a.length)) {
        text = text.split(media.slice('public'.length)).join(placeholder);
      }
      // Cover literal assets referenced by source but already missing privately.
      text = text.replace(/(["'`])\/(?!\/)[^"'`\s]*\.(?:png|jpe?g|avif|webp|gif|svg|ico)(?=["'`])/g, `$1${placeholder}`);
      text = text.replace(/\$\{baseUrl\}\/static\/[^"'`\s]+\.(?:png|jpe?g|svg)/g, `\${baseUrl}${placeholder}`);
    }
    if (file === 'app/layout.tsx') {
      text = text.replace("const trackingDisabled = process.env.ISOLATED_TEST_PROVIDERS === '1'", 'const trackingDisabled = true // Public reference export disables third-party browser tracking.');
      text = text.replace(/AW-17015350925/g, 'AW-0');
    }
    if (file === 'components/facebook-pixel.tsx') text = text.replace(/656784900393109/g, '0');
    if (file === 'vercel.json') {
      const config = JSON.parse(text);
      delete config.git; // Private branch deployment preferences are not portable.
      text = `${JSON.stringify(config, null, 2)}\n`;
    }
    if (file === '.gitattributes') {
      // Private archive exclusions must not remove placeholders/workers from
      // GitHub source downloads of the already-sanitized public repository.
      text = '* text=auto\n';
    }
    if (before !== text) transformations.push(file);
    bytes = Buffer.from(text);
  }
  // This is a guardrail, not a replacement for an independent secret scan.
  if (/(?:-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bsk_live_[A-Za-z0-9]{16,}|\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}|\bxox[baprs]-[A-Za-z0-9-]{20,})/.test(bytes.toString('utf8'))) {
    throw new Error(`Possible credential in ${file}; export stopped before writing.`);
  }
  output.set(file, bytes);
}
for (const required of ['.env.example', 'README.md', 'LICENSE', 'package.json', 'package-lock.json', 'scripts/public-release-branding.mjs', 'docs/open-source-release.md', 'scripts/patch-security-dependencies.mjs', 'scripts/security-patches/zod-v3.mjs', 'scripts/security-patches/deepmerge.mjs', 'docs/security-dependency-patches.md', 'THIRD_PARTY_NOTICES.md', 'third-party/pdfjs-LICENSE.txt']) {
  if (!output.has(required)) throw new Error(`Missing required release file: ${required}. Commit release preparation first, or use --worktree for a local preview.`);
}
output.set('public/release-placeholder.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000"><rect width="800" height="1000" fill="#f4efe6"/><rect x="160" y="180" width="480" height="580" rx="24" fill="#d3e0dc"/><path d="M250 325h300M250 405h300M250 485h220" stroke="#52736a" stroke-width="20" stroke-linecap="round"/><text x="400" y="850" text-anchor="middle" fill="#344e46" font-family="sans-serif" font-size="32">Add your own artwork</text></svg>\n'));
output.set('content/blog/.gitkeep', Buffer.from(''));
const manifest = {
  format: 1,
  sourceCommit: commit,
  mode: preview ? 'worktree-preview-do-not-publish' : 'committed-source',
  scope: 'Code and setup documentation; no history, credentials, course/blog drafts, or original media.',
  transformations,
  files: [...output.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([file, bytes]) => ({ file, sha256: createHash('sha256').update(bytes).digest('hex') })),
};
output.set('RELEASE-MANIFEST.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`));
fs.mkdirSync(destination, { recursive: true });
for (const [file, bytes] of output) {
  const target = path.join(destination, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes, { mode: (file === 'setup.sh' || file === 'scripts/check-database-schema.sh') ? 0o755 : 0o644 });
}
console.log(`Prepared ${output.size} files in ${destination}. Mode: ${manifest.mode}. Review the manifest and scan before publication.`);
