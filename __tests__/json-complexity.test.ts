import { assertJsonComplexity, DEFAULT_JSON_COMPLEXITY_LIMITS, JsonComplexityError } from '@/lib/json-complexity';

function nested(depth: number): unknown {
  let value: unknown = null;
  for (let index = 0; index < depth; index++) value = { child: value };
  return value;
}

function expectLimit(value: unknown, reason: keyof typeof DEFAULT_JSON_COMPLEXITY_LIMITS, overrides = {}) {
  let caught: unknown;
  try { assertJsonComplexity(value, overrides); } catch (error) { caught = error; }
  expect(caught).toBeInstanceOf(JsonComplexityError);
  expect(caught).toMatchObject({ reason, status: 413 });
}

it('publishes explicit immutable defaults', () => {
  expect(DEFAULT_JSON_COMPLEXITY_LIMITS).toEqual({ maxChildren: 1000, maxNodes: 5000, maxDepth: 30 });
  expect(Object.isFrozen(DEFAULT_JSON_COMPLEXITY_LIMITS)).toBe(true);
});

it.each([null, true, false, 0, 3.5, '', 'ordinary text', [], {}].map(value => [value]))('accepts an ordinary JSON root: %p', value => {
  expect(() => assertJsonComplexity(value)).not.toThrow();
});

it('accepts ordinary Inngest-style event and step state without changing it', () => {
  const value = {
    version: 1, event: { name: 'book/image.generate', data: { bookId: 'synthetic', appearance: { hair: 'brown' } } },
    events: [], steps: { one: { data: ['a', 'b'] } }, ctx: { attempt: 0, stack: { stack: [], current: 0 } },
  };
  const before = JSON.stringify(value);
  assertJsonComplexity(value);
  expect(JSON.stringify(value)).toBe(before);
});

it('accepts the exact per-array child boundary and rejects the next element', () => {
  expect(() => assertJsonComplexity(Array(1000).fill(null))).not.toThrow();
  expectLimit(Array(1001).fill(null), 'maxChildren');
});

it('rejects an unconstrained-validator-style 10k-element array before reading elements', () => {
  const value = Array(10000).fill(null);
  const read = jest.fn(() => { throw new Error('Oversized elements must not be read'); });
  Object.defineProperty(value, 9999, { get: read });
  expectLimit({ events: value }, 'maxChildren');
  expect(read).not.toHaveBeenCalled();
});

it('accepts the exact per-object child boundary and rejects the next property', () => {
  const value = Object.fromEntries(Array.from({ length: 1000 }, (_, index) => [`key${index}`, null]));
  expect(() => assertJsonComplexity(value)).not.toThrow();
  expectLimit({ ...value, extra: null }, 'maxChildren');
});

it('rejects oversized objects before reading or scheduling any property values', () => {
  const value = Object.fromEntries(Array.from({ length: 1001 }, (_, index) => [`key${index}`, null]));
  const read = jest.fn(() => { throw new Error('Oversized properties must not be read'); });
  Object.defineProperty(value, 'key0', { get: read, enumerable: true });
  expectLimit(value, 'maxChildren');
  expect(read).not.toHaveBeenCalled();
});

it('accepts depth 30, including its leaf, and rejects depth 31 without recursion', () => {
  expect(() => assertJsonComplexity(nested(30))).not.toThrow();
  expectLimit(nested(31), 'maxDepth');
  expectLimit(nested(10000), 'maxDepth');
});

it('counts aggregate nodes across many individually small containers', () => {
  // Root + five arrays + 4,994 leaf values = 5,000 total nodes.
  const atLimit = [Array(1000).fill(null), Array(1000).fill(null), Array(1000).fill(null), Array(1000).fill(null), Array(994).fill(null)];
  expect(() => assertJsonComplexity(atLimit)).not.toThrow();
  atLimit[4].push(null);
  expectLimit(atLimit, 'maxNodes');
});

it('counts object values and containers as nodes, without counting keys twice', () => {
  const value = { one: [null], two: { three: false } };
  expect(() => assertJsonComplexity(value, { maxNodes: 5 })).not.toThrow();
  expectLimit(value, 'maxNodes', { maxNodes: 4 });
});

it('checks remaining node capacity before reading children into the work queue', () => {
  const value: Record<string, unknown> = {};
  const read = jest.fn(() => { throw new Error('Unscheduled values must not be read'); });
  Object.defineProperty(value, 'one', { get: read, enumerable: true });
  expectLimit(value, 'maxNodes', { maxNodes: 1 });
  expect(read).not.toHaveBeenCalled();
});

it('checks depth before reading child values', () => {
  const value: Record<string, unknown> = {};
  const read = jest.fn(() => { throw new Error('Too-deep values must not be read'); });
  Object.defineProperty(value, 'one', { get: read, enumerable: true });
  expectLimit(value, 'maxDepth', { maxDepth: 0 });
  expect(read).not.toHaveBeenCalled();
});

it('supports explicit stricter limits while preserving omitted defaults', () => {
  expect(() => assertJsonComplexity(null, { maxNodes: 1, maxChildren: 0, maxDepth: 0 })).not.toThrow();
  expect(() => assertJsonComplexity({}, { maxChildren: 0, maxDepth: 0 })).not.toThrow();
  expectLimit([null], 'maxChildren', { maxChildren: 0 });
  expectLimit(nested(2), 'maxDepth', { maxDepth: 1 });
});

it('ignores inherited and non-enumerable properties, as parsed JSON does not contain them', () => {
  const value = Object.create({ inherited: Array(10000).fill(null) });
  value.own = null;
  Object.defineProperty(value, 'hidden', { value: nested(100) });
  expect(() => assertJsonComplexity(value, { maxChildren: 1, maxNodes: 2 })).not.toThrow();
});

it('handles JSON keys named __proto__ and constructor as ordinary own properties', () => {
  const value = JSON.parse('{"__proto__":{"child":1},"constructor":2}');
  expect(() => assertJsonComplexity(value, { maxNodes: 4 })).not.toThrow();
  expectLimit(value, 'maxNodes', { maxNodes: 3 });
});

it('terminates on unexpected cyclic input with a typed limit error instead of overflowing', () => {
  const cyclic: { child?: unknown } = {};
  cyclic.child = cyclic;
  expectLimit(cyclic, 'maxDepth');
});

it.each([
  { maxChildren: -1 }, { maxDepth: -1 }, { maxNodes: 0 },
  { maxNodes: Infinity }, { maxChildren: 1.5 }, { maxDepth: Number.MAX_SAFE_INTEGER + 1 },
])('rejects invalid caller configuration: %p', limits => {
  expect(() => assertJsonComplexity(null, limits)).toThrow(RangeError);
});
