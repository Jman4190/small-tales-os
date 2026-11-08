import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { after, test } from 'node:test';
import { deepmergePatch } from './deepmerge.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'deepmerge-security-'));
after(() => fs.rmSync(temporary, { recursive: true, force: true }));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const releasedGuards = `function propertyIsOnObject(object, property) {
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

// npm ci applies the maintained patch before tests. Restore only the known
// changes in a TEMPORARY copy, and prove the reconstructed release bytes match
// the pinned upstream SHA before using them for the vulnerable control cases.
function releasedSource(file) {
  let source = fs.readFileSync(path.join(root, 'node_modules/deepmerge', file.path), 'utf8');
  if (sha256(source) === file.originalSha256) return source;
  assert.equal(sha256(source), file.patchedSha256, `Unknown installed ${file.path}`);
  const indent = file.path === 'dist/umd.js' ? '\t' : '';
  const semicolon = file.path === 'index.js' ? '' : ';';
  const start = source.indexOf(`${indent}function propertyIsOnObject(`);
  const end = source.indexOf(`${indent}function mergeObject(`, start);
  const guards = releasedGuards.split('\n').map(line => line ? indent + line : '').join('\n');
  source = source.slice(0, start) + guards + source.slice(end);
  source = source.replace(`if (propertyIsUnsafe(target, key)) { return; }\n${indent}\t\t\tsetProperty(destination, key, cloneUnlessOtherwiseSpecified(target[key], options));`,
    `destination[key] = cloneUnlessOtherwiseSpecified(target[key], options)${semicolon}`);
  source = source.replace('setProperty(destination, key, getMergeFunction(key, options)(target[key], source[key], options));',
    `destination[key] = getMergeFunction(key, options)(target[key], source[key], options)${semicolon}`);
  source = source.replace('setProperty(destination, key, cloneUnlessOtherwiseSpecified(source[key], options));',
    `destination[key] = cloneUnlessOtherwiseSpecified(source[key], options)${semicolon}`);
  assert.equal(sha256(source), file.originalSha256, `Release reconstruction mismatch: ${file.path}`);
  return source;
}

const released = new Map(deepmergePatch.files.map(file => [file.path, releasedSource(file)]));
// index.js imports this development-only dependency, absent from the published
// runtime dependency tree. Supply the exact implementation bundled in cjs.js.
const bundled = released.get('dist/cjs.js');
const mergeableDependency = bundled.slice(bundled.indexOf('var isMergeableObject ='), bundled.indexOf('function emptyTarget(')) + '\nmodule.exports = isMergeableObject;\n';
const modules = new Map();
for (const state of ['original', 'patched']) {
  const directory = path.join(temporary, state);
  fs.mkdirSync(path.join(directory, 'dist'), { recursive: true });
  fs.mkdirSync(path.join(directory, 'node_modules/is-mergeable-object'), { recursive: true });
  fs.writeFileSync(path.join(directory, 'node_modules/is-mergeable-object/index.js'), mergeableDependency);
  const require = createRequire(path.join(directory, 'test.cjs'));
  for (const file of deepmergePatch.files) {
    const source = released.get(file.path);
    fs.writeFileSync(path.join(directory, file.path), state === 'patched' ? file.patch(source) : source);
    modules.set(`${state}:${file.path}`, require(path.join(directory, file.path)));
  }
}

const marker = 'deepmergePrototypeProbe';
const payload = () => JSON.parse(`{"__proto__":{"${marker}":true}}`);
const cases = [
  ['null-prototype target', merge => merge(Object.create(null), payload())],
  ['nested null placeholder', merge => merge({ session: null }, { session: payload() }).session],
  ['nested primitive placeholder', merge => merge({ session: 0 }, { session: payload() }).session],
  ['target own __proto__', merge => merge(payload(), {})],
  ['source and target own __proto__', merge => merge(payload(), payload())],
  ['nested target own __proto__', merge => merge({ session: payload() }, { session: { valid: true } }).session],
];

for (const file of deepmergePatch.files) {
  const original = modules.get(`original:${file.path}`);
  const patched = modules.get(`patched:${file.path}`);

  test(`${file.path}: reproduces returned-object poisoning in exact original; patch blocks every PoC`, () => {
    for (const [name, exploit] of cases) {
      const vulnerable = exploit(original);
      assert.equal(vulnerable[marker], true, `Original control: ${name}`);
      assert.equal(Object.hasOwn(vulnerable, marker), false);
      const safe = exploit(patched);
      assert.equal(safe[marker], undefined, `Patched: ${name}`);
      assert.equal(Object.getPrototypeOf(safe), Object.prototype);
      assert.equal(Object.hasOwn(safe, '__proto__'), false);
      assert.equal(({})[marker], undefined, 'This advisory concerns returned objects, not global pollution');
    }
  });

  test(`${file.path}: ignores all reserved target/source keys before reading getters`, () => {
    for (const key of ['__proto__', 'constructor', 'prototype']) {
      let reads = 0;
      const target = Object.create(null);
      Object.defineProperty(target, key, { enumerable: true, get() { reads++; throw new Error('Reserved getter read'); } });
      const source = Object.create(null);
      Object.defineProperty(source, key, { enumerable: true, get() { reads++; throw new Error('Reserved getter read'); } });
      const result = patched(target, source);
      assert.equal(reads, 0);
      assert.equal(Object.hasOwn(result, key), false);
      assert.equal(Object.getPrototypeOf(result), Object.prototype);
    }
  });

  test(`${file.path}: defines own data properties without invoking inherited string/symbol setters`, () => {
    for (const key of ['deepmergeSetterProbe', Symbol('deepmergeSetterProbe')]) {
      let calls = 0;
      Object.defineProperty(Object.prototype, key, { configurable: true, set() { calls++; } });
      try {
        const sourceResult = patched(Object.create(null), { [key]: 'source' });
        const targetResult = patched({ [key]: 'target' }, {});
        assert.equal(calls, 0);
        assert.deepEqual(Object.getOwnPropertyDescriptor(sourceResult, key), { value: 'source', enumerable: true, configurable: true, writable: true });
        assert.equal(targetResult[key], 'target');
      } finally { delete Object.prototype[key]; }
    }
  });

  test(`${file.path}: throwing proxy membership and descriptor checks fail closed`, () => {
    const throwingMembership = new Proxy(Object.assign(Object.create(null), { unsafe: 'target' }), {
      has() { throw new Error('Membership denied'); },
    });
    assert.deepEqual(patched(throwingMembership, { unsafe: 'source' }), {});
    const throwingDescriptor = new Proxy({}, {
      has() { return true; },
      getOwnPropertyDescriptor() { throw new Error('Descriptor denied'); },
    });
    assert.deepEqual(patched(throwingDescriptor, { unsafe: true }), {});
    let checks = 0;
    const secondCheckThrows = new Proxy(Object.create(null), { has() { if (++checks === 2) throw new Error('Later membership denied'); return false; } });
    assert.throws(() => patched(secondCheckThrows, { unsafe: true }), /Later membership denied/);
  });

  test(`${file.path}: preserves ordinary merges, cloning, custom options, symbols and callable values`, () => {
    const left = { nested: { left: true }, list: [{ left: 1 }] };
    const right = { nested: { right: true }, list: [{ right: 2 }] };
    assert.deepEqual(patched(left, right), original(left, right));
    const result = patched(left, right);
    assert.notEqual(result.nested, left.nested);
    assert.notEqual(result.list[0], left.list[0]);
    const shared = { value: 1 };
    assert.equal(patched({}, { shared }, { clone: false }).shared, shared);
    const fn = () => 'callable';
    const date = new Date('2026-11-07T00:00:00Z');
    const expression = /safe/g;
    const special = patched({}, { fn, date, expression });
    assert.equal(special.fn, fn);
    assert.equal(special.fn(), 'callable');
    assert.equal(special.date, date);
    assert.equal(special.expression, expression);
    const symbol = Symbol('valid');
    assert.deepEqual(patched({ [symbol]: { left: true } }, { [symbol]: { right: true } })[symbol], { left: true, right: true });
    const custom = { arrayMerge: (_target, source, options) => source.map(value => options.cloneUnlessOtherwiseSpecified(value, options)) };
    assert.deepEqual(patched(left, right, custom), original(left, right, custom));
    const customMerge = { customMerge: key => key === 'list' ? (a, b) => a.concat(b).length : undefined };
    assert.deepEqual(patched(left, right, customMerge), original(left, right, customMerge));
    assert.deepEqual(patched.all([{ a: 1 }, { b: 2 }]), { a: 1, b: 2 });
    assert.throws(() => patched.all({}), /first argument should be an array/);
  });

  test(`${file.path}: exact hashes, idempotence and unknown-byte rejection`, () => {
    const source = released.get(file.path);
    assert.equal(sha256(source), file.originalSha256);
    const transformed = file.patch(source);
    assert.equal(sha256(transformed), file.patchedSha256);
    assert.equal(file.patch(transformed), transformed);
    assert.throws(() => file.patch(source + '\n'), /Refusing unknown deepmerge/);
  });
}

test('UMD browser global entry also blocks poisoning while preserving normal enumerable symbols', () => {
  const context = vm.createContext({});
  const definition = deepmergePatch.files.find(file => file.path === 'dist/umd.js');
  vm.runInContext(definition.patch(released.get(definition.path)), context);
  assert.equal(typeof context.deepmerge, 'function');
  const safe = context.deepmerge(Object.create(null), payload());
  assert.equal(safe[marker], undefined);
  const symbol = Symbol('browser-value');
  assert.equal(context.deepmerge({}, { [symbol]: 42 })[symbol], 42);
});
