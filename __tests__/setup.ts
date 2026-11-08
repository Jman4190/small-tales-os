// Stub Next.js and Supabase env vars so modules load without crashing
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://your-project.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';
process.env.SUPABASE_SECRET_KEY = 'test-secret-key';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
process.env.INTERNAL_API_SECRET = 'test-internal-secret-32-chars-long!!';
process.env.LOGTAIL_TOKEN = 'test-logtail-token';
process.env.NEXT_PUBLIC_LOGTAIL_BROWSER_TOKEN = 'test-logtail-browser-token';
