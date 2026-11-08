const REDACTED = '[REDACTED]';

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (normalized === 'generatedimagecount') return false;
  return /(?:token|secret|password|apikey|credential|privatekey|accesskey|signature|authorization|cookie|session|email|phone|customer|address|postcode|postal|zipcode|ship|billing|url|path|appearance|skintone|eyecolor|hair|gender|photo|image|signedurl|pdfurl|filepath|prompt|name)/.test(normalized)
    || /^(?:age|childage|characterage|dob|dateofbirth|birthdate|ip|authcode|verificationcode)$/.test(normalized);
}

function sanitizeString(value: string): string {
  // JSON-serialized provider payloads must receive the same structural rules.
  if (/^\s*[\[{]/.test(value)) {
    try { return JSON.stringify(sanitizeLogDetails(JSON.parse(value))); } catch { /* ordinary text */ }
  }
  return value
    .replace(/https?:\/\/[^\s<>"'`]+/gi, REDACTED)
    .replace(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+(?:@|%40)[A-Z0-9.-]+\.[A-Z]{2,}/gi, REDACTED)
    .replace(/(?:Bearer\s+)[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/\b(?:eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|(?:sk|pk)_(?:live|test)_[A-Za-z0-9]+|xox[baprs]-[A-Za-z0-9-]+)\b/g, REDACTED)
    .replace(/((?:token|secret|password|api[_-]?key|authorization|cookie|session[_-]?id)\s*[=:]\s*)[^\s&,;"']+/gi, '$1[REDACTED]')
    .replace(/(?<![A-Za-z0-9])\+?\d[\d(). -]{7,}\d(?![A-Za-z0-9])/g, REDACTED);
}

export function redactToken(token?: string | null): string {
  return token ? REDACTED : '[MISSING]';
}

export function sanitizeLogDetails<T>(value: T, key?: string): T {
  const seen = new WeakSet<object>();
  function sanitize(current: unknown, currentKey?: string, depth = 0): unknown {
    if (currentKey && isSensitiveKey(currentKey)) return REDACTED;
    if (current == null) return current;
    if (depth > 15) return '[TRUNCATED]';
    if (typeof current === 'string') return sanitizeString(current);
    if (typeof current === 'bigint') return String(current);
    if (typeof current === 'function' || typeof current === 'symbol') return '[OMITTED]';
    if (typeof current !== 'object') return current;
    if (current instanceof Error) return { error_type: ['Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'URIError'].includes(current.name) ? current.name : 'Error' }; // Error text can echo arbitrary customer input.
    if (ArrayBuffer.isView(current) || current instanceof ArrayBuffer) return '[BINARY OMITTED]';
    if (current instanceof Date) return current.toISOString();
    if (seen.has(current)) return '[CIRCULAR]';
    seen.add(current);
    if (Array.isArray(current)) return current.map((item) => sanitize(item, currentKey, depth + 1));
    return Object.fromEntries(Object.entries(current).map(([entryKey, entryValue]) => [entryKey, sanitize(entryValue, entryKey, depth + 1)]));
  }
  return sanitize(value, key) as T;
}

export function extractBookPhotosRelativePath(filePath: string): string {
  if (!filePath) {
    return '';
  }

  const prefix = '/storage/v1/object/public/book-photos/';
  return filePath.includes(prefix) ? filePath.split(prefix)[1] : filePath;
}

export function isAllowedBookPhotosPdfPath(relativePath: string): boolean {
  if (!relativePath) {
    return false;
  }

  return (
    !relativePath.includes('..') &&
    relativePath.startsWith('pdfs/') &&
    relativePath.toLowerCase().endsWith('.pdf')
  );
}
