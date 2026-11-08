import { POST } from '@/app/api/admin-approve/route';
import { requireAdminUser } from '@/lib/admin-auth';

jest.mock('@/lib/admin-auth', () => ({ requireAdminUser: jest.fn() }));
jest.mock('@/lib/book-logger', () => ({ logBookEvent: jest.fn() }));
jest.mock('uuid', () => ({ v4: jest.fn() }));

it.each([401, 403])('rejects an unverified or nonadmin caller before processing an approval (%s)', async (status) => {
  (requireAdminUser as jest.Mock).mockResolvedValue({ ok: false, status, error: 'Denied' });
  const json = jest.fn();
  const response = await POST({ json } as unknown as Request);
  expect(response.status).toBe(status);
  expect(json).not.toHaveBeenCalled();
});
