import { requireAdminUser } from '@/lib/admin-auth';
import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));

const getUser = jest.fn();
const serviceClient = { from: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  (createClient as jest.Mock).mockResolvedValue({ auth: { getUser } });
  (createServiceClient as jest.Mock).mockReturnValue(serviceClient);
});

it('rejects an absent or unverifiable session before creating a privileged client', async () => {
  for (const result of [
    { data: { user: null }, error: null },
    { data: { user: { id: 'admin', app_metadata: { is_admin: true } } }, error: new Error('Invalid token') },
  ]) {
    getUser.mockResolvedValue(result);
    expect(await requireAdminUser()).toMatchObject({ ok: false, status: 401 });
  }
  expect(createServiceClient).not.toHaveBeenCalled();
});

it.each([undefined, false, 'true', 1])('rejects nonboolean admin claims (%s) and editable user metadata', async (claim) => {
  getUser.mockResolvedValue({
    data: { user: { id: 'customer', app_metadata: { is_admin: claim }, user_metadata: { is_admin: true } } },
    error: null,
  });
  expect(await requireAdminUser()).toMatchObject({ ok: false, status: 403 });
  expect(createServiceClient).not.toHaveBeenCalled();
});

it('provides a service client only after Supabase verifies a true administrator claim', async () => {
  const user = { id: 'admin', app_metadata: { is_admin: true } };
  getUser.mockResolvedValue({ data: { user }, error: null });
  expect(await requireAdminUser()).toMatchObject({ ok: true, user, supabase: serviceClient });
  expect(getUser).toHaveBeenCalledTimes(1);
  expect(createServiceClient).toHaveBeenCalledWith('https://your-project.supabase.co', 'test-secret-key', {
    auth: { persistSession: false, autoRefreshToken: false },
  });
});
