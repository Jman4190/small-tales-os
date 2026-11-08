import { sanitizeLogDetails } from './security';

const methods = ['log', 'info', 'warn', 'error', 'debug', 'trace', 'dir', 'table'] as const;
const installed = Symbol.for('small-tales.safe-console.installed');

// Defense in depth for provider payloads. Call sites must still avoid embedding
// arbitrary child/customer names in prose, which cannot be inferred reliably.
export function installSafeConsole(target: Console = console): void {
  const tagged = target as Console & { [installed]?: boolean };
  if (tagged[installed]) return;
  for (const method of methods) {
    const original = target[method].bind(target) as (...args: unknown[]) => void;
    Object.defineProperty(target, method, {
      configurable: true,
      writable: true,
      value: (...args: unknown[]) => {
        try { original(...args.map((argument) => sanitizeLogDetails(argument))); }
        catch { original('[Log details omitted]'); }
      },
    });
  }
  Object.defineProperty(target, installed, { value: true });
}
