import {
  getBooksForAdminSelection, getBookPhotos, updateImageUrl, triggerPdfRegeneration, getUpdatedPdfUrl,
} from '@/lib/supabaseAdminActions';
import { requireAdminUser } from '@/lib/admin-auth';

jest.mock('@/lib/admin-auth', () => ({ requireAdminUser: jest.fn() }));
jest.mock('@/lib/logger', () => ({ logBookEvent: jest.fn() }));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

const from = jest.fn();

beforeEach(() => jest.clearAllMocks());

it.each([401, 403])('protects every admin action independently of middleware (%s)', async (status) => {
  (requireAdminUser as jest.Mock).mockResolvedValue({ ok: false, status, error: 'Denied' });
  const actions = [
    () => getBooksForAdminSelection(),
    () => getBookPhotos('book'),
    () => updateImageUrl('photo', 'https://image.example/new', 'https://image.example/old', 'book', 'order'),
    () => triggerPdfRegeneration('book'),
    () => getUpdatedPdfUrl('order'),
  ];
  for (const action of actions) await expect(action()).rejects.toThrow('Denied');
  expect(requireAdminUser).toHaveBeenCalledTimes(actions.length);
  expect(from).not.toHaveBeenCalled();
});

it('reads paid orders through the verified service client', async () => {
  const query: any = {
    select: jest.fn(), eq: jest.fn(), not: jest.fn(), order: jest.fn(),
    returns: jest.fn().mockResolvedValue({
      data: [{ id: 'order', books: { id: 'book', name: 'Sam' } }, { id: 'orphan', books: null }], error: null,
    }),
  };
  for (const method of ['select', 'eq', 'not', 'order']) query[method].mockReturnValue(query);
  from.mockReturnValue(query);
  (requireAdminUser as jest.Mock).mockResolvedValue({ ok: true, user: { id: 'admin' }, supabase: { from } });
  expect(await getBooksForAdminSelection()).toEqual([{ order_id: 'order', book_id: 'book', title: 'Sam' }]);
  expect(from).toHaveBeenCalledWith('orders');
  expect(query.eq).toHaveBeenCalledWith('payment_status', 'paid');
});
