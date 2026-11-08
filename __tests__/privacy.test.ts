import { sanitizeLogDetails } from '@/lib/security';
import { analyticsPath, isAllowedAnalyticsEvent, safeAnalyticsProperties } from '@/lib/analytics-privacy';
import { installSafeConsole } from '@/lib/safe-console';

describe('private customer data does not enter diagnostic output', () => {
  it('fully removes sensitive objects, numeric fields and arrays including inherited parent sensitivity', () => {
    const original = {
      name: 'Alex Example', age: 4, gender: 'girl',
      appearance: { skinTone: 'olive', hair: 'brown' },
      generated_image_urls: ['https://private.example/image.jpg'],
      customer: [{ name: 'Parent Example', address: { line1: '123 Quiet Lane' } }],
      nested: [{ phone: '+1 (212) 555-0199', token: 'sensitive-token-content' }],
      count: 2,
    };
    const sanitized = sanitizeLogDetails(original);
    expect(sanitized).toEqual({ name: '[REDACTED]', age: '[REDACTED]', gender: '[REDACTED]', appearance: '[REDACTED]', generated_image_urls: '[REDACTED]', customer: '[REDACTED]', nested: [{ phone: '[REDACTED]', token: '[REDACTED]' }], count: 2 });
    expect(original.name).toBe('Alex Example');
  });

  it('removes entire embedded emails, phone numbers, signed URLs and tokens without retaining fragments', () => {
    const result = sanitizeLogDetails('Send to parent@example.com or +1 (212) 555-0199; PDF https://storage.example/private/file.pdf?token=secret123; token=secretABC');
    for (const fragment of ['parent', 'example.com', '212', '0199', 'storage.example', 'file.pdf', 'secret123', 'secretABC']) expect(result).not.toContain(fragment);
    expect(result).toContain('[REDACTED]');
  });

  it('handles serialized provider payloads, errors, cycles and binary values', () => {
    expect(sanitizeLogDetails(JSON.stringify({ name: 'Child Example', age: 5 }))).not.toContain('Child Example');
    expect(sanitizeLogDetails(new Error('Invalid child Child Example'))).toEqual({ error_type: 'Error' });
    const cyclic: Record<string, unknown> = { success: true }; cyclic.self = cyclic;
    expect(sanitizeLogDetails(cyclic)).toEqual({ success: true, self: '[CIRCULAR]' });
    expect(sanitizeLogDetails(new Uint8Array([1, 2]))).toBe('[BINARY OMITTED]');
  });

  it('sanitizes console arguments once while preserving ordinary operational messages', () => {
    const spy = jest.fn();
    const target = Object.fromEntries(['log', 'info', 'warn', 'error', 'debug', 'trace', 'dir', 'table'].map((key) => [key, spy])) as unknown as Console;
    installSafeConsole(target); installSafeConsole(target);
    target.log('Job finished', { age: 5, customer_email: 'parent@example.com', completed: true });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('Job finished', { age: '[REDACTED]', customer_email: '[REDACTED]', completed: true });
  });
});

describe('analytics keeps only anonymous operational metrics', () => {
  it('drops identifying and arbitrary fields even when their values use unexpected keys', () => {
    expect(safeAnalyticsProperties({ name: 'Alex', age: 4, appearance: { hair: 'brown' }, customer_email: 'parent@example.com', book_id: 'book-123', visitor_id: 'visitor-123', arbitrary: '123 Quiet Lane', userProperties: { email: 'parent@example.com' }, amount: 100, currency: 'USD', passes: true, generated_image_count: 3 })).toEqual({ amount: 100, currency: 'USD', passes: true, generated_image_count: 3 });
  });
  it('rejects invalid metric types and dynamic/query-bearing routes', () => {
    expect(safeAnalyticsProperties({ amount: 'parent@example.com', value: Infinity, currency: 'parent@example.com', status: 'Some personal reason', pathname: '/approve?token=secret' })).toEqual({});
    expect(analyticsPath('/approve')).toBe('/approve');
    expect(analyticsPath('/admin/books/private-book')).toBe('/other');
    expect(isAllowedAnalyticsEvent('Child Alex created')).toBe(false);
    expect(isAllowedAnalyticsEvent('Book Created')).toBe(true);
  });
});
