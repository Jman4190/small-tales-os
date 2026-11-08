import 'server-only';
import { supabaseSecretKey, supabaseUrl } from '@/lib/supabase-server-env'
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';

export async function requireAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false as const,
      status: 401,
      error: 'Unauthorized. Authentication required.',
    };
  }

  // getUser verifies the session with Supabase Auth. Only trusted app metadata
  // may grant this role; user_metadata and truthy strings are never sufficient.
  if (user.app_metadata?.is_admin !== true) {
    return {
      ok: false as const,
      status: 403,
      error: 'Forbidden. Admin access required.',
    };
  }

  return {
    ok: true as const,
    user,
    // Customer tables are inaccessible to browser roles. Create this privileged
    // client only after verifying the administrator on the server.
    supabase: createAdminClient(supabaseUrl, supabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}
