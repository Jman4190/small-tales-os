'use client'

import { createClient } from '@supabase/supabase-js'
import { supabasePublishableKey, supabaseUrl } from '@/lib/supabase-public-env'

// Client-side Supabase instance using the publishable key
if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing Supabase client credentials')
}

export const supabaseClient = createClient(supabaseUrl, supabasePublishableKey) 
