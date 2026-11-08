import { createHash } from 'node:crypto';

const sha256 = (source) => createHash('sha256').update(source).digest('hex');

function replaceOnce(source, before, after) {
  if (source.split(before).length !== 2) throw new Error('deepmerge patch anchor is not unique');
  return source.replace(before, after);
}

function harden(source, indent, semicolon) {
  const start = source.indexOf(`${indent}function propertyIsOnObject(`);
  const end = source.indexOf(`${indent}function mergeObject(`, start);
  if (start < 0 || end <= start) throw new Error('deepmerge property guards were not found');
  const guards = `function propertyIsOnObject(object, property) {
\treturn property in object;
}

// Reserved keys are never merged. Proxy/descriptor failures are unsafe too.
function propertyIsUnsafe(target, key) {
\tif (key === '__proto__' || key === 'constructor' || key === 'prototype') {
\t\treturn true;
\t}
\ttry {
\t\treturn propertyIsOnObject(target, key)
\t\t\t&& !(Object.prototype.hasOwnProperty.call(target, key)
\t\t\t\t&& Object.prototype.propertyIsEnumerable.call(target, key));
\t} catch (_) {
\t\treturn true;
\t}
}

// Define an own data property without invoking an inherited setter.
function setProperty(target, key, value) {
\tObject.defineProperty(target, key, {
\t\tvalue: value, enumerable: true, configurable: true, writable: true
\t});
}

`.split('\n').map((line) => line ? indent + line : '').join('\n');
  source = source.slice(0, start) + guards + source.slice(end);
  source = replaceOnce(source,
    `destination[key] = cloneUnlessOtherwiseSpecified(target[key], options)${semicolon}`,
    `if (propertyIsUnsafe(target, key)) { return; }\n${indent}\t\t\tsetProperty(destination, key, cloneUnlessOtherwiseSpecified(target[key], options));`);
  source = replaceOnce(source,
    `destination[key] = getMergeFunction(key, options)(target[key], source[key], options)${semicolon}`,
    'setProperty(destination, key, getMergeFunction(key, options)(target[key], source[key], options));');
  return replaceOnce(source,
    `destination[key] = cloneUnlessOtherwiseSpecified(source[key], options)${semicolon}`,
    'setProperty(destination, key, cloneUnlessOtherwiseSpecified(source[key], options));');
}

const variants = [
  ['index.js', '12440c84957c1990ea2d5e33dc0091722dc1dc1585c6d20e0c780e568ffa9d30', '20a3cb7d941f6eb7388b4f22619c00e72d3f8f5586974a7bb9d80dc7b422d07a', '', ''],
  ['dist/cjs.js', '2e5160f84a1141bd927264afe4d15766f1e6cf07daef182b37ff53fea121de7d', 'e80fbe15f458ade123f2e484881a964617efc5f6abbee09e75ec5055971b6206', '', ';'],
  ['dist/umd.js', 'f33e6596482d1fb5c7c427f8ef92f2aa849eea9223acd974176b2fb27ddbf73a', '461fcc44d95b39f3ee3f335811cdf805b23bbe07e93bbeaff137c1bc57cd1b65', '\t', ';'],
];

export const deepmergePatch = {
  name: 'deepmerge',
  version: '4.3.1',
  files: variants.map(([path, originalSha256, patchedSha256, indent, semicolon]) => ({
    path, originalSha256, patchedSha256,
    patch(source) {
      const hash = sha256(source);
      if (hash === patchedSha256) return source;
      if (hash !== originalSha256) throw new Error(`Refusing unknown deepmerge ${path} contents`);
      const result = harden(source, indent, semicolon);
      if (sha256(result) !== patchedSha256) throw new Error(`deepmerge ${path} patched hash mismatch: ${sha256(result)}`);
      return result;
    },
  })),
};
