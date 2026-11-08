import fs from 'fs';
import path from 'path';

function typeScriptFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return typeScriptFiles(file);
    return /\.tsx?$/.test(entry.name) ? [file] : [];
  });
}

describe('transactional email migration surface', () => {
  it('keeps provider-specific calls inside the shared email sender', () => {
    const files = ['app', 'components', 'inngest', 'lib', 'utils']
      .flatMap((directory) => typeScriptFiles(path.join(process.cwd(), directory)))
      .filter((file) => file !== path.join(process.cwd(), 'lib/email.ts'));

    const violations = files.filter((file) => {
      const source = fs.readFileSync(file, 'utf8');
      return (
        /from ['"]resend['"]/.test(source) ||
        source.includes('api.resend.com') ||
        source.includes('.emails.send(') ||
        source.includes('/email/sending/send') ||
        /import\s*\{[^}]*\b(sendCloudflareEmail|sendResendEmail)\b[^}]*\}\s*from ['"]@\/lib\/email['"]/.test(source)
      );
    });

    expect(violations).toEqual([]);
  });

  it('keeps every migrated production path on the shared sender', () => {
    const emailFiles = [
      'app/api/course/signup/route.ts',
      'app/api/gelato/webhooks/route.ts',
      'inngest/functions/resendPreviewEmail.ts',
      'inngest/functions/sendInternalPdfNotification.ts',
      'inngest/functions/sendPreviewEmail.ts',
      'inngest/functions/sendShippingEmail.ts',
    ];

    const violations = emailFiles.filter((file) => {
      const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      return !source.includes('sendEmail({');
    });

    expect(violations).toEqual([]);
  });

  it('routes customer replies to the support address', () => {
    const customerEmailFiles = [
      'app/api/course/signup/route.ts',
      'inngest/functions/resendPreviewEmail.ts',
      'inngest/functions/sendPreviewEmail.ts',
      'inngest/functions/sendShippingEmail.ts',
    ];

    const violations = customerEmailFiles.filter((file) => {
      const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      return !source.includes('replyTo: EMAIL_REPLY_TO_SUPPORT');
    });

    expect(violations).toEqual([]);
  });
});
