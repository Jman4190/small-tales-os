import { createHash } from 'node:crypto';

// Backport the early constrained-collection checks from Zod's v4 fix:
// https://github.com/colinhacks/zod/commit/a0ebf97
// This does not impose limits on unconstrained arrays, rest tuples, sets, or maps.
const sha256 = source => createHash('sha256').update(source).digest('hex');

function replaceOnce(source, original, replacement, label) {
  if (source.split(original).length !== 2) throw new Error(`Zod patch anchor mismatch: ${label}`);
  return source.replace(original, replacement);
}

function patchClass(source, name, transform) {
  const startMarker = `class ${name} extends ZodType {`;
  const endMarker = `${name}.create =`;
  if (source.split(startMarker).length !== 2 || source.split(endMarker).length !== 2) {
    throw new Error(`Zod patch class mismatch: ${name}`);
  }
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (end < start) throw new Error(`Zod patch class boundary mismatch: ${name}`);
  return source.slice(0, start) + transform(source.slice(start, end)) + source.slice(end);
}

function patchRuntime(source, commonJs) {
  const invalid = commonJs ? 'parseUtil_js_1.INVALID' : 'INVALID';
  source = patchClass(source, 'ZodArray', block => {
    block = replaceOnce(block,
      'message: def.exactLength.message,\n                });\n                status.dirty();',
      `message: def.exactLength.message,\n                });\n                if (tooBig) return ${invalid};\n                status.dirty();`,
      'array exact length');
    return replaceOnce(block,
      'message: def.maxLength.message,\n                });\n                status.dirty();',
      `message: def.maxLength.message,\n                });\n                return ${invalid};`,
      'array maximum');
  });
  source = patchClass(source, 'ZodSet', block => replaceOnce(block,
    'message: def.maxSize.message,\n                });\n                status.dirty();',
    `message: def.maxSize.message,\n                });\n                return ${invalid};`,
    'set maximum'));
  return patchClass(source, 'ZodTuple', block => replaceOnce(block,
    '            status.dirty();\n        }\n        const items = [...ctx.data]',
    `            return ${invalid};\n        }\n        const items = [...ctx.data]`,
    'tuple fixed length'));
}

const manifests = [
  {
    "path": "v3/types.js",
    "originalSha256": "9763a2938f0e7f983363ef4bf6530e7583e3f2d54f8a4a6684efad58febc6e8e",
    "patchedSha256": "bef6b6efbabddd299864639e1dcbd5c1afe80afa22bc588c7541b5d8d29755f6"
  },
  {
    "path": "v3/types.cjs",
    "originalSha256": "06487cc05ed45c5dd29789bf0aa75734d1ce06592a7f2665ba4ca90a68e8a3e1",
    "patchedSha256": "e590feef389b1ea9b4d2ea7ec4c6773c5adcf944a776a8b5780a6ae956bc24b3"
  }
];

export const zodPatch = {
  name: 'zod',
  version: '3.25.76',
  files: manifests.map(file => ({
    ...file,
    patch(source) {
      if (sha256(source) !== file.originalSha256) throw new Error(`Unexpected original Zod bytes: ${file.path}`);
      const patched = patchRuntime(source, file.path.endsWith('.cjs'));
      if (sha256(patched) !== file.patchedSha256) throw new Error(`Unexpected patched Zod bytes: ${file.path}`);
      return patched;
    },
  })),
};
