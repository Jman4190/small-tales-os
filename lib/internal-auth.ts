import { timingSafeEqual } from 'crypto';

/**
 * Verifies that a request comes from within this application (server-to-server).
 * Routes that should only be callable internally (e.g. /api/gelato/*) use this
 * to prevent external callers from triggering expensive third-party operations.
 *
 * Set INTERNAL_API_SECRET to a random 32+ character string in your environment.
 * All internal callers must pass it as the `x-internal-secret` header.
 */
export function verifyInternalSecret(request: Request): boolean {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    console.error('[internal-auth] INTERNAL_API_SECRET is not configured');
    return false;
  }
  const provided = request.headers.get('x-internal-secret') ?? '';
  // Use constant-time comparison to prevent timing side-channel attacks.
  if (provided.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
}
