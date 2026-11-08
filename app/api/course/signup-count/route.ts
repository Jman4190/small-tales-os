import { supabaseSecretKey, supabaseUrl } from '@/lib/supabase-server-env'
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseSecretKey
);

export const revalidate = 30; // Revalidate every 30 seconds

export async function GET() {
  try {
    const { count, error } = await supabaseAdmin
      .from('course_signups')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Error getting signup count:', error);
      return NextResponse.json({ count: 0 }, { status: 500 });
    }

    return NextResponse.json({ count: count || 0 });
  } catch (error) {
    console.error('Signup count error:', error);
    return NextResponse.json({ count: 0 }, { status: 500 });
  }
}
