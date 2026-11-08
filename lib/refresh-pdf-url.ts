import 'server-only';
import { supabaseUrl } from '@/lib/supabase-public-env';
import { isAllowedBookPhotosPdfPath } from '@/lib/security';

/** Refresh only this project's private PDF, never fall back to an opaque locator. */
export async function refreshPdfUrl(filePath: string, appUrl: string, expiresIn: number): Promise<string> {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) throw new Error('Internal authentication is not configured');
  const storageOrigin = new URL(supabaseUrl).origin;
  let relativePath = filePath;
  if (/^https?:\/\//i.test(filePath)) {
    const source = new URL(filePath);
    const match = source.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/book-photos\/(.+)$/);
    if (source.origin !== storageOrigin || !match) throw new Error('PDF storage locator is not allowed');
    relativePath = decodeURIComponent(match[1]);
  }
  if (!isAllowedBookPhotosPdfPath(relativePath)) throw new Error('PDF storage path is not allowed');

  const response = await fetch(new URL('/api/refresh-signed-url', appUrl), {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
    headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': secret },
    body: JSON.stringify({ filePath: relativePath, expiresIn }),
  });
  if (!response.ok) throw new Error('Unable to refresh private PDF');
  const data = await response.json();
  if (typeof data.signedUrl !== 'string') throw new Error('Private PDF signing returned no URL');
  const signed = new URL(data.signedUrl);
  if (signed.origin !== storageOrigin || signed.username || signed.password ||
      decodeURIComponent(signed.pathname) !== `/storage/v1/object/sign/book-photos/${relativePath}` ||
      !signed.searchParams.get('token')) {
    throw new Error('Private PDF signing returned an invalid URL');
  }
  return signed.href;
}
