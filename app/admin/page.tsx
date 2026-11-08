'use client'; // Add use client directive

import { useState, useEffect, useMemo } from 'react'; // Import React hooks
import { getBooksForAdminSelection } from '@/lib/supabaseAdminActions';
import Link from 'next/link';

// Define the expected type for the book data
// Renamed for clarity
type BookListData = {
  order_id: string;
  book_id: string;
  title: string; // This holds the character name
};

export default function AdminDashboardPage() {
  // State for data, loading, error, and filter
  const [booksData, setBooksData] = useState<BookListData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [filter, setFilter] = useState('');

  // Fetch data on component mount
  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      try {
        // The layout and server action each verify administrator access.
        const data = await getBooksForAdminSelection();
        setBooksData(data);
        setFetchError(false);
      } catch (error: any) {
        console.error("Failed to fetch books for admin dashboard:", error);
        setFetchError(true);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthAndFetchData();
  }, []);

  // Filtered data based on the filter state
  const filteredBooks = useMemo(() => {
    return booksData.filter((book) => {
        const searchTerm = filter.toLowerCase();
        return (
          book.title.toLowerCase().includes(searchTerm) ||
          book.order_id.toLowerCase().includes(searchTerm)
        );
      }
    );
  }, [booksData, filter]);

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto p-4 text-center">
        <p>Loading orders...</p> {/* Add a loading indicator */}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard - Book Orders</h1>
      <p className="mb-6 text-gray-600">View paid orders and edit the associated book details.</p>

      {/* Search Input */}
      <div className="mb-4">
        <label htmlFor="order-search" className="sr-only">Search Orders</label>
        <input
          type="text"
          id="order-search"
          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full md:w-1/2 p-2.5 placeholder-gray-400"
          placeholder="Search by character name or order ID..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Character Name
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Order ID
              </th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Edit</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {fetchError ? (
              <tr>
                <td colSpan={3} className="px-6 py-4 text-center text-sm text-red-500">
                  Failed to load orders. Please refresh the page.
                </td>
              </tr>
            ) : filteredBooks.length > 0 ? (
              filteredBooks.map((book) => (
                <tr key={book.order_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {book.title}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {book.order_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link href={`/admin/books/${book.book_id}`} className="text-indigo-600 hover:text-indigo-900 hover:underline">
                      Edit Book &rarr;
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                  {filter ? 'No orders match your search.' : 'No paid orders found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add other admin dashboard elements here if needed */}
    </div>
  );
}

// Metadata is usually static for client components or handled differently
// export const metadata = {
//   title: 'Admin Dashboard - Orders', // Updated title
// };
