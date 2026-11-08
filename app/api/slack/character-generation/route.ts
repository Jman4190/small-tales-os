import { readBoundedJsonObject, BodyLimitError } from '@/lib/request-body';
import { hasBookAccess } from '@/lib/guest-access'
import { guardPublicRequest } from '@/lib/request-security'
import { supabase } from '@/utils/supabase'
import { NextResponse } from 'next/server'
import { notifyGeneratedImage } from '@/lib/slack'
import { logBookEvent } from '@/lib/book-logger'

export async function POST(request: Request) {
  const denied = await guardPublicRequest(request, 'character-notification');
  if (denied) return denied;
  try {
    const input = await readBoundedJsonObject(request)
    if (typeof input.bookId !== 'string' || !hasBookAccess(request, input.bookId)) return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    const { data: book, error } = await supabase.from('books').select('id,name,gender,age,appearance,status,generated_image_urls').eq('id', input.bookId).single()
    if (error || !book || book.status !== 'completed') return NextResponse.json({ error: 'Book not ready' }, { status: 400 })
    const data = { bookId: book.id, name: book.name, gender: book.gender, age: book.age, appearance: book.appearance, generatedImageUrls: book.generated_image_urls || [], durationMs: typeof input.durationMs === 'number' && input.durationMs >= 0 && input.durationMs < 3600000 ? input.durationMs : undefined }
    if (!data.generatedImageUrls.length) return NextResponse.json({ error: 'Book not ready' }, { status: 400 })

    // Log the event (server-side)
    logBookEvent(data.bookId, 'character_generation_notification', {
      durationMs: data.durationMs,
      imageCount: data.generatedImageUrls.length
    })
    
    // Send Slack notification with duration included
    await notifyGeneratedImage({
      bookId: data.bookId,
      name: data.name,
      gender: data.gender,
      age: data.age,
      appearance: data.appearance,
      generatedImageUrl: data.generatedImageUrls[0],
      generatedImageUrls: data.generatedImageUrls.slice(1),
      durationMs: data.durationMs
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof BodyLimitError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in character generation notification:', error)
    return NextResponse.json({ error: 'Failed to process notification' }, { status: 500 })
  }
} 