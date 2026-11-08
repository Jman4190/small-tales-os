#!/usr/bin/env node
// Maintained security backports for exact locked npm artifacts. No network or
// application credentials are used. Unknown files stop installation/builds.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { zodPatch } from './security-patches/zod-v3.mjs';
import { deepmergePatch } from './security-patches/deepmerge.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export function applySecurityPatches(projectRoot, { check = false } = {}) {
  const modulesPath = path.join(projectRoot, 'node_modules');
  if (fs.lstatSync(modulesPath).isSymbolicLink()) throw new Error('Security patches require a regular npm node_modules directory; linked layouts are unsupported.');
  const modules = fs.realpathSync(modulesPath);
  const definitions = new Map([zodPatch, deepmergePatch].map((item) => [item.name, item]));
  const found = new Map();
  const pending = [];
  const results = [];

  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      if (entry.isSymbolicLink()) throw new Error('Security patches require regular npm package directories; linked layouts are unsupported.');
      if (!entry.isDirectory()) continue;
      const packageDirectory = path.join(directory, entry.name);
      if (entry.name.startsWith('@')) { visit(packageDirectory); continue; }
      const metadataFile = path.join(packageDirectory, 'package.json');
      if (fs.existsSync(metadataFile)) {
        const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
        const definition = definitions.get(metadata.name);
        if (definition) {
          if (metadata.version !== definition.version) throw new Error(`Review security patches for ${metadata.name}@${metadata.version}; expected ${definition.version}.`);
          found.set(metadata.name, (found.get(metadata.name) || 0) + 1);
          for (const item of definition.files) {
            const file = path.join(packageDirectory, item.path);
            const real = fs.realpathSync(file);
            if (!real.startsWith(modules + path.sep) || !fs.lstatSync(file).isFile()) throw new Error('Security patch target must be a regular local dependency file.');
            const original = fs.readFileSync(file);
            const digest = sha256(original);
            if (digest === item.patchedSha256) continue;
            if (digest !== item.originalSha256) throw new Error(`Unexpected dependency contents: ${metadata.name}/${item.path}. Run npm ci and review any dependency update.`);
            if (check) throw new Error(`Missing security patch: ${metadata.name}/${item.path}. Run npm ci with lifecycle scripts enabled.`);
            const patched = Buffer.from(item.patch(original.toString('utf8')));
            if (sha256(patched) !== item.patchedSha256) throw new Error(`Security patch output mismatch: ${metadata.name}/${item.path}.`);
            pending.push({ file, patched, mode: fs.statSync(file).mode });
          }
          results.push(`${metadata.name}@${metadata.version}`);
        }
      }
      const nested = path.join(packageDirectory, 'node_modules');
      if (fs.existsSync(nested)) {
        if (fs.lstatSync(nested).isSymbolicLink()) throw new Error('Security patches require regular npm nested directories; linked layouts are unsupported.');
        visit(nested);
      }
    }
  }
  visit(modules);
  if (!found.has('zod')) throw new Error('Required Zod dependency is missing; run npm ci.');
  // deepmerge is used by Jest and is absent from production-only installations.
  if (fs.existsSync(path.join(modules, 'jest-config')) && !found.has('deepmerge')) throw new Error('Jest deepmerge dependency is missing.');
  // Validate every target before writing any target, so mismatched packages do
  // not leave an installation with a partially applied patch set.
  for (const { file, patched, mode } of pending) {
    const temporary = `${file}.security-${randomBytes(8).toString('hex')}`;
    try {
      fs.writeFileSync(temporary, patched, { mode, flag: 'wx' });
      fs.renameSync(temporary, file);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }
  return { packages: results, changedFiles: pending.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.slice(2).some((argument) => argument !== '--check')) throw new Error('Usage: node scripts/patch-security-dependencies.mjs [--check]');
    const result = applySecurityPatches(root, { check: process.argv.includes('--check') });
    process.stdout.write(`Security backports verified: ${result.packages.join(', ')} (${result.changedFiles} files updated).\n`);
  } catch (error) {
    process.stderr.write(`Security dependency check failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
