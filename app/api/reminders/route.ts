import { readBoundedJsonObject, BodyLimitError } from '@/lib/request-body';
import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';
import { guardPublicRequest } from '@/lib/request-security';

export async function POST(request: Request) {
  const denied = await guardPublicRequest(request, 'reminder');
  if (denied) return denied;
  try {
    const { childName, email, reminderDate } = await readBoundedJsonObject(request);
    if (typeof childName !== 'string' || !childName.trim() || childName.length > 100 ||
        typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        typeof reminderDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(reminderDate) ||
        !Number.isFinite(Date.parse(reminderDate)) || new Date(reminderDate).toISOString().slice(0, 10) !== reminderDate ||
        Date.parse(reminderDate) < Date.now() - 86400000 || Date.parse(reminderDate) > Date.now() + 5 * 365 * 86400000) {
      return NextResponse.json({ error: 'Please enter valid reminder details' }, { status: 400 });
    }
    const { error } = await supabase.from('reminders').insert({ child_name: childName.trim(), email: email.trim().toLowerCase(), reminder_date: reminderDate });
    if (error) return NextResponse.json({ error: 'Unable to save reminder' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: error instanceof BodyLimitError ? error.message : 'Invalid reminder request' }, { status: error instanceof BodyLimitError ? error.status : 400 }); }
}
