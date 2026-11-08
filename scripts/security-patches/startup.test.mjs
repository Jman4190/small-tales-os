import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { deepmergePatch } from './deepmerge.mjs';
import { zodPatch } from './zod-v3.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const digest = value => createHash('sha256').update(value).digest('hex');

function fixture(includeDev = true) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'small-tales-startup-'));
  for (const file of ['next.config.mjs', 'scripts/patch-security-dependencies.mjs',
    'scripts/security-patches/deepmerge.mjs', 'scripts/security-patches/zod-v3.mjs',
    'scripts/start-isolated-test.mjs', 'scripts/isolated-providers.cjs']) {
    const destination = path.join(directory, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(root, file), destination);
  }
  for (const definition of includeDev ? [zodPatch, deepmergePatch] : [zodPatch]) {
    const installed = path.join(root, 'node_modules', definition.name);
    const destination = path.join(directory, 'node_modules', definition.name);
    fs.mkdirSync(destination, { recursive: true });
    fs.copyFileSync(path.join(installed, 'package.json'), path.join(destination, 'package.json'));
    for (const file of definition.files) {
      const source = fs.readFileSync(path.join(installed, file.path));
      assert.equal(digest(source), file.patchedSha256, `Expected checked installed artifact ${definition.name}/${file.path}`);
      const target = path.join(destination, file.path);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, source);
    }
  }
  return directory;
}

function withFixture(work, includeDev = true) {
  const directory = fixture(includeDev);
  try { return work(directory); }
  finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

// Reconstruct only index.js in the disposable fixture. Its pinned upstream hash
// proves this is the actual unpatched release, rather than a generic corruption.
function restoreUnpatchedIndex(directory) {
  const file = deepmergePatch.files.find(item => item.path === 'index.js');
  const target = path.join(directory, 'node_modules/deepmerge/index.js');
  let source = fs.readFileSync(target, 'utf8');
  const start = source.indexOf('function propertyIsOnObject(');
  const end = source.indexOf('function mergeObject(', start);
  const guards = `function propertyIsOnObject(object, property) {
\ttry {
\t\treturn property in object
\t} catch(_) {
\t\treturn false
\t}
}

// Protects from prototype poisoning and unexpected merging up the prototype chain.
function propertyIsUnsafe(target, key) {
\treturn propertyIsOnObject(target, key) // Properties are safe to merge if they don't exist in the target yet,
\t\t&& !(Object.hasOwnProperty.call(target, key) // unsafe if they exist up the prototype chain,
\t\t\t&& Object.propertyIsEnumerable.call(target, key)) // and also unsafe if they're nonenumerable.
}

`;
  source = source.slice(0, start) + guards + source.slice(end);
  source = source.replace('if (propertyIsUnsafe(target, key)) { return; }\n\t\t\tsetProperty(destination, key, cloneUnlessOtherwiseSpecified(target[key], options));',
    'destination[key] = cloneUnlessOtherwiseSpecified(target[key], options)');
  source = source.replace('setProperty(destination, key, getMergeFunction(key, options)(target[key], source[key], options));',
    'destination[key] = getMergeFunction(key, options)(target[key], source[key], options)');
  source = source.replace('setProperty(destination, key, cloneUnlessOtherwiseSpecified(source[key], options));',
    'destination[key] = cloneUnlessOtherwiseSpecified(source[key], options)');
  assert.equal(digest(source), file.originalSha256);
  fs.writeFileSync(target, source);
  return target;
}

function child(directory, program) {
  // No application profile, service credentials, NODE_OPTIONS or npm hooks are
  // inherited. Ignore-scripts is explicit while loading the real config directly.
  return spawnSync(process.execPath, ['--input-type=module', '-e', program], {
    cwd: directory, encoding: 'utf8', timeout: 10000,
    env: { PATH: process.env.PATH || '', NODE_ENV: 'production',
      NEXT_PUBLIC_SUPABASE_URL: 'https://your-project.supabase.co', npm_config_ignore_scripts: 'true' },
  });
}

function importConfig(directory) {
  const config = pathToFileURL(path.join(directory, 'next.config.mjs')).href;
  return child(directory, `try {
    const { default: config } = await import(${JSON.stringify(config)});
    if (!Array.isArray(config.images?.remotePatterns)) throw new Error('Real config was not loaded');
    process.stdout.write('CONFIG_IMPORTED');
  } catch (error) { process.stderr.write(error.message); process.exitCode = 41; }`);
}

function launcherProbe(directory) {
  const launcher = pathToFileURL(path.join(directory, 'scripts/start-isolated-test.mjs')).href;
  const syntheticProfile = path.join(directory, 'NEVER_READ_PROFILE.env');
  return child(directory, `
    import fs from 'node:fs';
    import net from 'node:net';
    import http from 'node:http';
    import https from 'node:https';
    import processes from 'node:child_process';
    import { syncBuiltinESMExports } from 'node:module';
    let profileTouched = false, networkTouched = false, childSpawned = false;
    const realpath = fs.realpathSync;
    fs.realpathSync = function(file, ...args) {
      if (String(file) === ${JSON.stringify(syntheticProfile)}) {
        profileTouched = true; throw new Error('SYNTHETIC_PROFILE_REACHED');
      }
      return realpath.call(this, file, ...args);
    };
    const blockNetwork = () => { networkTouched = true; throw new Error('NETWORK_FORBIDDEN'); };
    globalThis.fetch = blockNetwork;
    net.createServer = net.connect = net.createConnection = blockNetwork;
    http.request = http.get = https.request = https.get = blockNetwork;
    processes.spawn = () => { childSpawned = true; throw new Error('SPAWN_FORBIDDEN'); };
    syncBuiltinESMExports();
    let errorMessage;
    try {
      const { main } = await import(${JSON.stringify(launcher)});
      await main([${JSON.stringify(syntheticProfile)}, '--preview-only']);
    } catch (error) { errorMessage = error.message; }
    process.stdout.write(JSON.stringify({ errorMessage, profileTouched, networkTouched, childSpawned }));
  `);
}

test('direct real Next config import succeeds for checked dependencies with npm scripts disabled', () => withFixture(directory => {
  const result = importConfig(directory);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'CONFIG_IMPORTED');
}));

test('direct Next config import rejects exact unpatched release bytes without silently repairing them', () => withFixture(directory => {
  const file = restoreUnpatchedIndex(directory);
  const before = fs.readFileSync(file);
  const result = importConfig(directory);
  assert.equal(result.status, 41, result.stderr);
  assert.match(result.stderr, /Missing security patch: deepmerge\/index\.js/);
  assert.equal(result.stdout, '');
  assert.deepEqual(fs.readFileSync(file), before);
}));

test('direct Next config import rejects altered runtime bytes without npm lifecycle prehooks', () => withFixture(directory => {
  const file = path.join(directory, 'node_modules/zod', zodPatch.files[0].path);
  fs.appendFileSync(file, '\n// unexpected runtime change\n');
  const before = fs.readFileSync(file);
  const result = importConfig(directory);
  assert.equal(result.status, 41, result.stderr);
  assert.match(result.stderr, /Unexpected dependency contents: zod\//);
  assert.deepEqual(fs.readFileSync(file), before);
}));

test('direct Next config import rejects a missing required Zod runtime', () => withFixture(directory => {
  fs.rmSync(path.join(directory, 'node_modules/zod'), { recursive: true });
  const result = importConfig(directory);
  assert.equal(result.status, 41, result.stderr);
  assert.match(result.stderr, /Required Zod dependency is missing/);
}));

test('direct Next config import supports checked production-only dependencies', () => withFixture(directory => {
  const result = importConfig(directory);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'CONFIG_IMPORTED');
}, false));

for (const state of ['unpatched', 'altered']) {
  test(`isolated launcher rejects ${state} dependencies before profile, network or service startup`, () => withFixture(directory => {
    if (state === 'unpatched') restoreUnpatchedIndex(directory);
    else fs.appendFileSync(path.join(directory, 'node_modules/zod', zodPatch.files[0].path), '\n// altered\n');
    const result = launcherProbe(directory);
    assert.equal(result.status, 0, result.stderr);
    const outcome = JSON.parse(result.stdout);
    assert.match(outcome.errorMessage, state === 'unpatched' ? /Missing security patch/ : /Unexpected dependency contents/);
    assert.equal(outcome.profileTouched, false);
    assert.equal(outcome.networkTouched, false);
    assert.equal(outcome.childSpawned, false);
  }));
}

test('launcher probe reaches only the synthetic profile boundary when dependencies are valid', () => withFixture(directory => {
  const result = launcherProbe(directory);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    errorMessage: 'SYNTHETIC_PROFILE_REACHED', profileTouched: true, networkTouched: false, childSpawned: false,
  });
}));
