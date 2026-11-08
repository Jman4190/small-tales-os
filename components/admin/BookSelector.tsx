'use client';

import { useRouter } from 'next/navigation';
import React, { useState, useMemo } from 'react';

// Define the type for the book data received as props
// This should match the type used in the parent server component
type BookSelectionData = {
  order_id: string;
  book_id: string;
  title: string;
};

interface BookSelectorProps {
  books: BookSelectionData[];
}

export default function BookSelector({ books }: BookSelectorProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');

  const handleSelectionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedBookId = event.target.value;
    if (selectedBookId) {
      // Navigate to the specific book's admin page
      router.push(`/admin/books/${selectedBookId}`);
    }
  };

  // Filter books based on search term (order_id)
  const filteredBooks = useMemo(() => {
    if (!searchTerm) {
      return books;
    }
    return books.filter(book =>
      book.order_id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [books, searchTerm]);

  return (
    <div className="mb-6 max-w-md relative">
      {/* Search Input */}
      <div className="mb-4">
        <label htmlFor="order-search" className="block text-sm font-medium text-gray-700 mb-1">
          Search by Order ID:
        </label>
        <input
          type="text"
          id="order-search"
          placeholder="Enter Order ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2"
        />
      </div>

      {/* Dropdown */}
      <div className="relative">
        <label htmlFor="book-select" className="block text-sm font-medium text-gray-700 mb-1">
          Select a Book:
        </label>
        <select
          id="book-select"
          name="book"
          onChange={handleSelectionChange}
          defaultValue=""
          className="block w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
        >
          <option value="" disabled>
            -- Select a Book --
          </option>
          {filteredBooks.map((book) => (
            <option key={book.book_id} value={book.book_id}>
              {book.title} (Order: {book.order_id})
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-700">
          <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M10 3a.75.75 0 01.53.22l3.5 3.5a.75.75 0 01-1.06 1.06L10 4.81 6.53 8.28a.75.75 0 01-1.06-1.06l3.5-3.5A.75.75 0 0110 3zm-3.72 9.28a.75.75 0 011.06 0L10 15.19l3.47-3.47a.75.75 0 111.06 1.06l-4 4a.75.75 0 01-1.06 0l-4-4a.75.75 0 010-1.06z" clipRule="evenodd" />
          </svg>
        </div>
        {filteredBooks.length === 0 && searchTerm && (
          <p className="text-sm text-red-600 mt-2">No books found matching '{searchTerm}'.</p>
        )}
        {books.length === 0 && !searchTerm && (
          <p className="text-sm text-gray-500 mt-2">No books available for selection.</p>
        )}
      </div>
    </div>
  );
}
