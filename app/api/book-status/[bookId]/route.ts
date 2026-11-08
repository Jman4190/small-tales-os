import { hasBookAccess } from '@/lib/guest-access'
import { guardPublicRequest } from '@/lib/request-security'
import { isUuid } from '@/lib/security'
import { supabaseSecretKey, supabaseUrl } from '@/lib/supabase-server-env'
// /app/api/book-status/[bookId]/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  supabaseUrl,
  supabaseSecretKey
)

export async function GET(request: Request, context: any) {
  const { bookId } = await context.params as { bookId: string };

  // Validate bookId format to prevent probing with arbitrary strings
  if (!isUuid(bookId)) {
    return NextResponse.json({ error: 'Invalid book ID' }, { status: 400 });
  }

  if (!hasBookAccess(request, bookId)) return NextResponse.json({ error: 'Book not found' }, { status: 404 });
  const denied = await guardPublicRequest(request, 'book-status');
  if (denied) return denied;

  console.log("Fetching status for book:", {
    bookId,
    timestamp: new Date().toISOString()
  });

  try {
    const { data, error } = await supabase
      .from('books')
      .select('id, status, generated_image_urls')
      .eq('id', bookId)
      .single();

    if (error) {
      console.error("Database error:", {
        error,
        bookId,
        message: error.message
      });
      return NextResponse.json({ error: 'Failed to fetch book status' }, { status: 500 });
    }

    if (!data) {
      // Return generic 404 — don't confirm whether the ID exists or not
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    console.log("Book status retrieved:", {
      bookId,
      status: data.status,
      generatedImageCount: data.generated_image_urls?.length ?? 0,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error("Unexpected error:", {
      error,
      bookId,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json({
      error: 'An unexpected error occurred'
    }, { status: 500 });
  }
} 
