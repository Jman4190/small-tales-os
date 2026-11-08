export interface JsonComplexityLimits {
  maxChildren: number;
  maxNodes: number;
  maxDepth: number;
}

export const DEFAULT_JSON_COMPLEXITY_LIMITS: Readonly<JsonComplexityLimits> = Object.freeze({
  maxChildren: 1000,
  maxNodes: 5000,
  maxDepth: 30,
});

export class JsonComplexityError extends Error {
  readonly status = 413;

  constructor(public readonly reason: keyof JsonComplexityLimits, public readonly limit: number) {
    super(`JSON complexity exceeds ${reason} limit (${limit})`);
    this.name = 'JsonComplexityError';
  }
}

/**
 * Bound a parsed JSON tree before a downstream validator can amplify its work.
 * The root counts as one node at depth zero; keys do not count as extra nodes.
 */
export function assertJsonComplexity(value: unknown, overrides: Partial<JsonComplexityLimits> = {}): void {
  const limits: JsonComplexityLimits = {
    maxChildren: overrides.maxChildren ?? DEFAULT_JSON_COMPLEXITY_LIMITS.maxChildren,
    maxNodes: overrides.maxNodes ?? DEFAULT_JSON_COMPLEXITY_LIMITS.maxNodes,
    maxDepth: overrides.maxDepth ?? DEFAULT_JSON_COMPLEXITY_LIMITS.maxDepth,
  };
  for (const key of ['maxChildren', 'maxNodes', 'maxDepth'] as const) {
    if (!Number.isSafeInteger(limits[key]) || limits[key] < (key === 'maxNodes' ? 1 : 0)) {
      throw new RangeError(`Invalid JSON complexity limit: ${key}`);
    }
  }

  const pending: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
  let nodes = 1;

  function reserveChildren(count: number, depth: number): void {
    if (count > limits.maxChildren) throw new JsonComplexityError('maxChildren', limits.maxChildren);
    if (count && depth === limits.maxDepth) throw new JsonComplexityError('maxDepth', limits.maxDepth);
    // Count nodes before scheduling them so the work queue itself stays bounded.
    if (count > limits.maxNodes - nodes) throw new JsonComplexityError('maxNodes', limits.maxNodes);
    nodes += count;
  }

  while (pending.length) {
    const current = pending.pop()!;
    if (Array.isArray(current.value)) {
      reserveChildren(current.value.length, current.depth);
      for (let index = current.value.length - 1; index >= 0; index--) {
        pending.push({ value: current.value[index], depth: current.depth + 1 });
      }
    } else if (current.value !== null && typeof current.value === 'object') {
      const object = current.value as Record<string, unknown>;
      const keys: string[] = [];
      // Object.keys/entries would allocate every key before discovering an
      // oversized object. Stop at the first disallowed own enumerable key.
      for (const key in object) {
        if (!Object.prototype.hasOwnProperty.call(object, key)) continue;
        if (keys.length === limits.maxChildren) throw new JsonComplexityError('maxChildren', limits.maxChildren);
        keys.push(key);
      }
      reserveChildren(keys.length, current.depth);
      for (let index = keys.length - 1; index >= 0; index--) {
        pending.push({ value: object[keys[index]], depth: current.depth + 1 });
      }
    }
  }
}
