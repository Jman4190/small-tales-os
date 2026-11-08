describe('Supabase environment helpers', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://your-project.supabase.co';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('prefers the new publishable key when both names are set', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'new-publishable-key';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'legacy-anon-key';

    const { supabasePublishableKey } = await import('../lib/supabase-public-env');

    expect(supabasePublishableKey).toBe('new-publishable-key');
  });

  it('falls back to the legacy anon key during migration', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'legacy-anon-key';

    const { supabasePublishableKey } = await import('../lib/supabase-public-env');

    expect(supabasePublishableKey).toBe('legacy-anon-key');
  });

  it('prefers the new secret key when both names are set', async () => {
    process.env.SUPABASE_SECRET_KEY = 'new-secret-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'legacy-service-role-key';

    const { supabaseSecretKey } = await import('../lib/supabase-server-env');

    expect(supabaseSecretKey).toBe('new-secret-key');
  });

  it('falls back to the legacy service role key during migration', async () => {
    delete process.env.SUPABASE_SECRET_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'legacy-service-role-key';

    const { supabaseSecretKey } = await import('../lib/supabase-server-env');

    expect(supabaseSecretKey).toBe('legacy-service-role-key');
  });
});
