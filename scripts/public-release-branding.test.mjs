import test from 'node:test';
import assert from 'node:assert/strict';
import { neutralizePublicBranding } from './public-release-branding.mjs';

test('public presentation uses a neutral name and reserved social destinations', () => {
  const input = `<h1>Small Tales Books</h1><img alt="Small Tales logo" /><a href="https://www.instagram.com/smalltalesbooks">Small Tales</a><a href="https://www.tiktok.com/@smalltalesbooks">TikTok</a>`;
  const result = neutralizePublicBranding('components/footer.tsx', input);
  assert.ok(!result.includes('Small Tales'));
  assert.ok(!result.includes('instagram.com/smalltalesbooks'));
  assert.ok(!result.includes('tiktok.com/@smalltalesbooks'));
  assert.match(result, /Storybook Starter/);
  assert.match(result, /https:\/\/example\.com\/social\/instagram/);
  assert.match(result, /https:\/\/example\.com\/social\/tiktok/);
});

test('email display text changes while internal IDs, object paths and license attribution remain intact', () => {
  const input = `name: 'Small Tales', id: 'small-tales', cookie: 'small-tales.safe-console.installed', path: 'book-photos/cover_image/cover-image-small-tales.jpg'`;
  const result = neutralizePublicBranding('lib/email.ts', input);
  assert.ok(result.includes("name: 'Storybook Starter'"));
  for (const stable of ["id: 'small-tales'", "cookie: 'small-tales.safe-console.installed'", "path: 'book-photos/cover_image/cover-image-small-tales.jpg'"]) assert.ok(result.includes(stable));
  const license = 'MIT License\nCopyright (c) 2025 Jman4190\nSmall Tales';
  assert.equal(neutralizePublicBranding('LICENSE', license), license);
  assert.equal(neutralizePublicBranding('inngest/client.ts', input), input);
});
