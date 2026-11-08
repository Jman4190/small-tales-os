import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applySecurityPatches } from '../patch-security-dependencies.mjs';
import { zodPatch } from './zod-v3.mjs';
import { deepmergePatch } from './deepmerge.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
function fixture(includeDev = true) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'small-tales-security-install-'));
  for (const definition of includeDev ? [zodPatch, deepmergePatch] : [zodPatch]) {
    const target = path.join(directory, 'node_modules', definition.name);
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({ name: definition.name, version: definition.version }));
    for (const item of definition.files) {
      const file = path.join(target, item.path);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.copyFileSync(path.join(root, 'node_modules', definition.name, item.path), file);
    }
  }
  return directory;
}
function usingFixture(fn, includeDev = true) {
  const directory = fixture(includeDev);
  try { return fn(directory); } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

test('installed backports are complete and repeated checking/writing is idempotent', () => usingFixture((directory) => {
  assert.equal(applySecurityPatches(directory, { check: true }).changedFiles, 0);
  assert.equal(applySecurityPatches(directory).changedFiles, 0);
}));

test('unknown dependency files fail closed without modifying another target', () => usingFixture((directory) => {
  const good = path.join(directory, 'node_modules/zod', zodPatch.files[0].path);
  const before = fs.readFileSync(good);
  fs.appendFileSync(path.join(directory, 'node_modules/deepmerge', deepmergePatch.files[0].path), '\n// unexpected artifact\n');
  assert.throws(() => applySecurityPatches(directory), /Unexpected dependency contents/);
  assert.deepEqual(fs.readFileSync(good), before);
}));

test('an unexpected nested version stops the installation for review', () => usingFixture((directory) => {
  const nested = path.join(directory, 'node_modules/example/node_modules/zod');
  fs.mkdirSync(nested, { recursive: true });
  fs.writeFileSync(path.join(nested, 'package.json'), JSON.stringify({ name: 'zod', version: '0.0.0' }));
  assert.throws(() => applySecurityPatches(directory), /Review security patches/);
}));

test('production-only installs do not require the Jest-only dependency', () => usingFixture((directory) => {
  assert.deepEqual(applySecurityPatches(directory, { check: true }).packages, [`zod@${zodPatch.version}`]);
}, false));

test('dependency file symlinks are rejected without writing through them', () => usingFixture((directory) => {
  const item = zodPatch.files[0];
  const file = path.join(directory, 'node_modules/zod', item.path);
  const original = path.join(root, 'node_modules/zod', item.path);
  const before = fs.readFileSync(original);
  fs.unlinkSync(file);
  fs.symlinkSync(original, file);
  assert.throws(() => applySecurityPatches(directory), /regular local dependency file/);
  assert.deepEqual(fs.readFileSync(original), before);
}));

for (const kind of ['root', 'package', 'nested']) {
  test(`linked ${kind} directories fail closed without changing their targets`, () => usingFixture((directory) => {
    const modules = path.join(directory, 'node_modules');
    const before = fs.readFileSync(path.join(root, 'node_modules/zod', zodPatch.files[0].path));
    if (kind === 'root') {
      fs.renameSync(modules, `${modules}-saved`);
      fs.symlinkSync(path.join(root, 'node_modules'), modules);
    } else if (kind === 'package') {
      fs.symlinkSync(path.join(root, 'node_modules/zod'), path.join(modules, 'linked-zod'));
    } else {
      const parent = path.join(modules, 'example');
      fs.mkdirSync(parent);
      fs.symlinkSync(path.join(root, 'node_modules'), path.join(parent, 'node_modules'));
    }
    assert.throws(() => applySecurityPatches(directory), /linked layouts are unsupported/);
    assert.deepEqual(fs.readFileSync(path.join(root, 'node_modules/zod', zodPatch.files[0].path)), before);
  }));
}
