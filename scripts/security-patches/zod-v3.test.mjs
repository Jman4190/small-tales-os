import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { zodPatch } from './zod-v3.mjs';

const require = createRequire(import.meta.url);
const sha256 = value => createHash('sha256').update(value).digest('hex');
const packageRoot = dirname(require.resolve('zod/package.json'));
const packageJson = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
assert.equal(packageJson.version, zodPatch.version, 'Patch fixtures require the pinned Zod package');
const fixtureRoot = mkdtempSync(join(tmpdir(), 'small-tales-zod-security-'));
const originalRoot = join(fixtureRoot, 'original');
const patchedRoot = join(fixtureRoot, 'patched');
cpSync(packageRoot, originalRoot, { recursive: true });
cpSync(packageRoot, patchedRoot, { recursive: true });

// npm postinstall may already have patched the installed package. Recover a
// pristine fixture only after verifying the complete known patched-file hash,
// then verify it against the immutable npm-byte hash before using it as baseline.
function pristineFixture(source, file) {
  if (sha256(source) === file.originalSha256) return source;
  assert.equal(sha256(source), file.patchedSha256, `Unknown installed bytes: ${file.path}`);
  const invalid = file.path.endsWith('.cjs') ? 'parseUtil_js_1.INVALID' : 'INVALID';
  source = source.replace(`                if (tooBig) return ${invalid};\n`, '');
  for (const field of ['maxLength', 'maxSize']) {
    source = source.replace(
      `message: def.${field}.message,\n                });\n                return ${invalid};`,
      `message: def.${field}.message,\n                });\n                status.dirty();`,
    );
  }
  source = source.replace(
    `            return ${invalid};\n        }\n        const items = [...ctx.data]`,
    '            status.dirty();\n        }\n        const items = [...ctx.data]',
  );
  assert.equal(sha256(source), file.originalSha256, `Pristine fixture hash mismatch: ${file.path}`);
  return source;
}

const installedHashes = new Map();
for (const file of zodPatch.files) {
  const installed = readFileSync(join(packageRoot, file.path), 'utf8');
  installedHashes.set(file.path, sha256(installed));
  const source = pristineFixture(installed, file);
  writeFileSync(join(originalRoot, file.path), source);
  writeFileSync(join(patchedRoot, file.path), file.patch(source));
}

after(() => {
  for (const file of zodPatch.files) {
    assert.equal(sha256(readFileSync(join(packageRoot, file.path))), installedHashes.get(file.path), 'Tests must never change installed Zod');
  }
  rmSync(fixtureRoot, { recursive: true, force: true });
});

const runtimes = [
  ['CommonJS', require(join(originalRoot, 'v3/index.cjs')), require(join(patchedRoot, 'v3/index.cjs'))],
  ['ES modules', await import(pathToFileURL(join(originalRoot, 'v3/index.js'))), await import(pathToFileURL(join(patchedRoot, 'v3/index.js')))],
];

for (const file of zodPatch.files) {
  test(`${file.path}: exact npm bytes produce the declared patched hash`, () => {
    const original = readFileSync(join(originalRoot, file.path), 'utf8');
    const patched = file.patch(original);
    assert.equal(sha256(patched), file.patchedSha256);
    assert.throws(() => file.patch(`${original}\n`), /Unexpected original Zod bytes/);
    assert.throws(() => file.patch(patched), /Unexpected original Zod bytes/);
  });
}

function parse(schema, input, asynchronous, options) {
  return asynchronous ? schema.safeParseAsync(input, options) : schema.safeParse(input, options);
}

const constrainedCollections = [
  ['array max', (z, element) => z.array(element).max(2, 'array maximum'), () => Array(10000).fill(7)],
  ['array exact length', (z, element) => z.array(element).length(2, 'array exact length'), () => Array(10000).fill(7)],
  ['set max', (z, element) => z.set(element).max(2, 'set maximum'), () => new Set(Array.from({ length: 10000 }, (_, i) => i))],
  ['set exact size', (z, element) => z.set(element).size(2, 'set exact size'), () => new Set(Array.from({ length: 10000 }, (_, i) => i))],
];

for (const [runtime, original, patched] of runtimes) {
  for (const asynchronous of [false, true]) {
    const mode = asynchronous ? 'async' : 'sync';
    for (const [collection, makeSchema, makeInput] of constrainedCollections) {
      test(`${runtime} ${mode}: ${collection} rejects 10k invalid elements before visiting any`, async () => {
        let originalVisits = 0;
        let patchedVisits = 0;
        const originalPreprocess = value => { originalVisits++; return value; };
        const patchedPreprocess = value => { patchedVisits++; return value; };
        const oldElement = original.preprocess(asynchronous ? async value => originalPreprocess(value) : originalPreprocess, original.string());
        const newElement = patched.preprocess(asynchronous ? async value => patchedPreprocess(value) : patchedPreprocess, patched.string());
        const before = await parse(makeSchema(original, oldElement), makeInput(), asynchronous);
        const after = await parse(makeSchema(patched, newElement), makeInput(), asynchronous);
        assert.equal(before.success, false);
        assert.equal(after.success, false);
        assert.equal(originalVisits, 10000);
        assert.equal(before.error.issues.length, 10001);
        assert.equal(patchedVisits, 0);
        assert.equal(after.error.issues.length, 1);
        assert.equal(after.error.issues[0].code, 'too_big');
        assert.deepEqual(after.error.issues[0], before.error.issues[0], 'Bound metadata, message and path must stay identical');
      });
    }

    test(`${runtime} ${mode}: fixed tuple rejects before copying or visiting a 10k-element input`, async () => {
      function fixture(z) {
        let iterated = 0;
        let parsed = 0;
        const input = Array(10000).fill('valid');
        input[Symbol.iterator] = function* () {
          for (let index = 0; index < this.length; index++) { iterated++; yield this[index]; }
        };
        const element = z.preprocess(value => { parsed++; return value; }, z.string());
        return { schema: z.tuple([element, element]), input, counts: () => ({ iterated, parsed }) };
      }
      const before = fixture(original);
      const after = fixture(patched);
      const oldResult = await parse(before.schema, before.input, asynchronous);
      const newResult = await parse(after.schema, after.input, asynchronous);
      assert.deepEqual(before.counts(), { iterated: 10000, parsed: 2 });
      assert.deepEqual(after.counts(), { iterated: 0, parsed: 0 });
      assert.equal(newResult.success, false);
      assert.deepEqual(newResult.error.issues, oldResult.error.issues);
    });

    test(`${runtime} ${mode}: in-bound transforms, refinements, and error paths remain unchanged`, async () => {
      for (const input of [[1, 2], [0, -1], [1], 'not-an-array']) {
        function schema(z) {
          const refine = value => value > 0;
          const element = z.number().transform(value => value * 2)
            .refine(asynchronous ? async value => refine(value) : refine, 'must be positive');
          return z.object({ items: z.array(element).length(2, 'exactly two').max(3, 'at most three') });
        }
        const before = await parse(schema(original), { items: input }, asynchronous);
        const after = await parse(schema(patched), { items: input }, asynchronous);
        assert.equal(after.success, before.success);
        if (after.success) assert.deepEqual(after.data, before.data);
        else assert.deepEqual(after.error.issues, before.error.issues);
      }
    });

    test(`${runtime} ${mode}: in-bound sets and tuples preserve transformed values and minimum errors`, async () => {
      const cases = [
        [z => z.set(z.string().transform(value => value.trim())).max(2), new Set([' a ', 'b'])],
        [z => z.set(z.string()).size(2, 'exact set'), new Set(['a'])],
        [z => z.tuple([z.string().transform(value => value.trim()), z.number()]), [' a ', 2]],
        [z => z.tuple([z.string(), z.number()]), ['a']],
      ];
      for (const [schema, input] of cases) {
        const before = await parse(schema(original), input, asynchronous);
        const after = await parse(schema(patched), input, asynchronous);
        assert.equal(after.success, before.success);
        if (after.success) assert.deepEqual(after.data, before.data);
        else assert.deepEqual(after.error.issues, before.error.issues);
      }
    });

    test(`${runtime} ${mode}: nested oversized schemas retain custom error maps and skip child and outer refinements`, async () => {
      let children = 0;
      let outer = 0;
      const element = patched.preprocess(value => { children++; return value; }, patched.number());
      const refine = () => { outer++; return true; };
      const schema = patched.object({ values: patched.array(element).max(1).refine(asynchronous ? async () => refine() : refine) });
      const result = await parse(schema, { values: [1, 2, 3] }, asynchronous, {
        errorMap: issue => ({ message: `custom ${issue.code}` }),
      });
      assert.equal(result.success, false);
      assert.deepEqual(result.error.issues, [{ code: 'too_big', maximum: 1, type: 'array', inclusive: true, exact: false, path: ['values'], message: 'custom too_big' }]);
      assert.equal(children, 0);
      assert.equal(outer, 0);
    });

    test(`${runtime} ${mode}: unconstrained collections and rest tuples do not gain invented limits`, async () => {
      const cases = [
        [z => z.array(z.number()), Array.from({ length: 100 }, (_, i) => i)],
        [z => z.set(z.number()), new Set(Array.from({ length: 100 }, (_, i) => i))],
        [z => z.tuple([z.string()]).rest(z.number()), ['first', 1, 2, 3]],
        [z => z.map(z.string(), z.number()), new Map([['a', 1], ['b', 2]])],
      ];
      for (const [schema, input] of cases) {
        const before = await parse(schema(original), input, asynchronous);
        const after = await parse(schema(patched), input, asynchronous);
        assert.equal(after.success, true);
        assert.deepEqual(after.data, before.data);
      }
    });
  }
}
