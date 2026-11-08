import middleware from '@/middleware';
import { createServerClient } from '@supabase/ssr';
import { NextRequest } from 'next/server';

jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }));

function session(user: unknown, error: unknown = null) {
  (createServerClient as jest.Mock).mockImplementation((_url, _key, options) => ({
    auth: { getUser: async () => {
      options.cookies.setAll([{ name: 'session', value: 'refreshed', options: { httpOnly: true, path: '/' } }]);
      return { data: { user }, error };
    } },
  }));
}

beforeEach(() => jest.clearAllMocks());

it('retains refreshed cookies when redirecting an unauthenticated visitor', async () => {
  session(null);
  const response = await middleware(new NextRequest('http://localhost/admin/books/book'));
  expect(response.status).toBe(307);
  expect(response.headers.get('location')).toContain('/login?');
  expect(response.cookies.get('session')?.value).toBe('refreshed');
});

it.each([undefined, false, 'true'])('rejects customers and malformed administrator claims (%s) with refreshed cookies', async (claim) => {
  session({ id: 'customer', app_metadata: { is_admin: claim } });
  const response = await middleware(new NextRequest('http://localhost/admin'));
  expect(response.status).toBe(403);
  expect(response.cookies.get('session')?.value).toBe('refreshed');
});

it('rejects a failed session verification even if a user was returned', async () => {
  session({ id: 'admin', app_metadata: { is_admin: true } }, new Error('Invalid token'));
  expect((await middleware(new NextRequest('http://localhost/admin'))).status).toBe(307);
});

it('allows a verified administrator and retains refreshed cookies', async () => {
  session({ id: 'admin', app_metadata: { is_admin: true } });
  const response = await middleware(new NextRequest('http://localhost/admin'));
  expect(response.status).toBe(200);
  expect(response.cookies.get('session')?.value).toBe('refreshed');
});
