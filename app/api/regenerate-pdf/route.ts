import { NextResponse } from 'next/server';
import { isUuid } from '@/lib/security';
import { readBoundedJson, BodyLimitError } from '@/lib/request-body';
import { inngest } from '@/inngest/client';
import { requireAdminUser } from '@/lib/admin-auth';

export async function POST(request: Request) {
  const admin = await requireAdminUser();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  let body: unknown;
  try {
    body = await readBoundedJson(request);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: error instanceof BodyLimitError ? error.status : 400 });
  }

  try {
    if (!body || typeof body !== 'object' || !('bookId' in body) || !('orderId' in body) || !isUuid(body.bookId) || !isUuid(body.orderId)) {
      return NextResponse.json({ error: 'Valid bookId and orderId are required.' }, { status: 400 });
    }
    const { bookId, orderId } = body;

    // Ensure the queued job uses a real paid order belonging to this book.
    const { data: order, error } = await admin.supabase
      .from('orders')
      .select('id')
      .eq('id', orderId)
      .eq('book_id', bookId)
      .eq('payment_status', 'paid')
      .maybeSingle();
    if (error) throw error;
    if (!order) {
      return NextResponse.json({ error: 'Paid order for this book was not found.' }, { status: 404 });
    }

    await inngest.send({
      name: 'book/pdf.regenerate.requested',
      data: { bookId, orderId },
      user: { id: admin.user.id },
    });
    return NextResponse.json({ message: 'PDF regeneration triggered successfully.' });
  } catch (error: unknown) {
    console.error('API: Error triggering PDF regeneration:', error);
    return NextResponse.json({ error: 'Failed to trigger regeneration.' }, { status: 500 });
  }
}
