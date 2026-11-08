import 'server-only';

import { supabaseUrl } from '@/lib/supabase-public-env';

const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseSecretKey) {
  throw new Error(
    'Missing SUPABASE_SECRET_KEY environment variable. Legacy fallback SUPABASE_SERVICE_ROLE_KEY is also unset.'
  );
}

export { supabaseSecretKey, supabaseUrl };
