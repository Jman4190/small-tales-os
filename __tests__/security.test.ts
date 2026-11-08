import {
  extractBookPhotosRelativePath,
  isAllowedBookPhotosPdfPath,
  redactToken,
  sanitizeLogDetails,
} from '@/lib/security';

describe('security helpers', () => {
  it('redacts sensitive nested log values', () => {
    const sanitized = sanitizeLogDetails({
      token: 'test-redaction-value',
      nested: {
        customer_email: 'person@example.com',
        pdfUrl: 'https://example.com/file.pdf?token=abcdef',
      },
      safeValue: 'keep me',
    });

    expect(sanitized.token).toBe('[REDACTED]');
    expect(sanitized.nested.customer_email).toContain('[REDACTED]');
    expect(sanitized.nested.customer_email).not.toBe('person@example.com');
    expect(sanitized.nested.pdfUrl).toContain('[REDACTED]');
    expect(sanitized.nested.pdfUrl).not.toContain('example.com/file.pdf');
    expect(sanitized.safeValue).toBe('keep me');
  });

  it('extracts the relative book-photos path from a public storage URL', () => {
    expect(
      extractBookPhotosRelativePath(
        'https://your-project.supabase.co/storage/v1/object/public/book-photos/pdfs/orders/123/generated.pdf'
      )
    ).toBe('pdfs/orders/123/generated.pdf');
  });

  it('allows only pdf files under the pdfs directory', () => {
    expect(isAllowedBookPhotosPdfPath('pdfs/orders/123/generated.pdf')).toBe(true);
    expect(isAllowedBookPhotosPdfPath('uploads/avatar.png')).toBe(false);
    expect(isAllowedBookPhotosPdfPath('../pdfs/orders/123/generated.pdf')).toBe(false);
  });

  it('redacts tokens consistently', () => {
    expect(redactToken('test-redaction-value')).toBe('[REDACTED]');
    expect(redactToken(null)).toBe('[MISSING]');
  });
});
