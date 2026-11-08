import { createHmac } from 'node:crypto';
import { readBoundedJsonObject, BodyLimitError } from '@/lib/request-body';
import { supabaseSecretKey, supabaseUrl } from '@/lib/supabase-server-env';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { inngest } from '@/inngest/client';
import { logBookEvent } from '@/lib/book-logger';
import { trackPostHogEvent } from '@/lib/posthog-tracker';
import { guardPublicRequest, guardAiBudget } from '@/lib/request-security';
import { grantAccess, isUploadPath, readGrant } from '@/lib/guest-access';

const supabase = createClient(supabaseUrl, supabaseSecretKey);
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const denied = await guardPublicRequest(request, 'create-book');
  if (denied) return denied;
  try {
    const { name, gender, age, filePath } = await readBoundedJsonObject(request);
    if (typeof name !== 'string' || !name.trim() || name.length > 100 || !['boy', 'girl'].includes(gender) ||
        !Number.isInteger(age) || age < 1 || age > 18 || !isUploadPath(filePath)) {
      return NextResponse.json({ error: 'Invalid book details' }, { status: 400 });
    }
    const verification = readGrant(request, 'upload', filePath);
    if (verification?.kind !== 'verified-upload' || !verification.appearance) {
      return NextResponse.json({ error: 'Please verify your photo first' }, { status: 403 });
    }
    // One atomic reservation per verified photo, including concurrent browser retries.
    const { data: creation, error } = await supabase.rpc('create_book_from_upload', {
      p_upload_key: createHmac('sha256', process.env.INTERNAL_API_SECRET!).update(filePath).digest('hex'),
      p_book: { name: name.trim(), gender, age, original_image_url: filePath, status: 'pending_verification', appearance: verification.appearance },
    });
    if (error || !creation?.book) {
      console.error('Book creation could not be reserved', error);
      return NextResponse.json({ error: 'Unable to create book. Please try again.' }, { status: 503 });
    }
    const book = creation.book;
    if (creation.created) {
      void logBookEvent(book.id, 'book_created', {}).catch(() => {});
      void trackPostHogEvent('Book Created', {}).catch(() => {});
    }
    if (book.status === 'failed') {
      return grantAccess(NextResponse.json({ error: 'This preview could not be generated. Please try another photo.' }, { status: 409 }), 'book', book.id);
    }
    if (book.status === 'pending_verification' || book.status === 'queue_failed') {
      const budgetDenied = await guardAiBudget('create-book');
      if (budgetDenied) return grantAccess(budgetDenied, 'book', book.id);
      try {
        // Stable IDs let a retry safely recover an uncertain event-send result.
        await inngest.send({
          id: `book-preview-${book.id}`,
          name: 'book/image.generate',
          data: { bookId: book.id, gender: book.gender, originalImageUrl: book.original_image_url, name: book.name, age: book.age, appearance: book.appearance },
        });
      } catch {
        // Do not overwrite a job that has already started after an uncertain send.
        await supabase.from('books').update({ status: 'queue_failed' }).eq('id', book.id).in('status', ['pending_verification', 'queue_failed']);
        return grantAccess(NextResponse.json({ error: 'Unable to start your preview. Please try again.' }, { status: 503 }), 'book', book.id);
      }
    }
    return grantAccess(NextResponse.json({ message: 'Book creation started', data: { id: book.id, status: book.status === 'completed' ? 'completed' : 'processing' } }), 'book', book.id);
  } catch (error) {
    if (error instanceof BodyLimitError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Unable to create book', error);
    return NextResponse.json({ error: 'Unable to create book. Please try again.' }, { status: 500 });
  }
}
