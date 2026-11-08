'use client';

import { useState } from 'react';

interface AdminApproveButtonProps {
  bookId: string;
  orderId: string | null; // Allow null for initial loading state
}

export default function AdminApproveButton({ bookId, orderId }: AdminApproveButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const handleAdminApprove = async () => {
    if (!bookId || !orderId) {
      setMessage('Cannot approve without Book ID and Order ID.');
      setIsError(true);
      return;
    }

    setIsLoading(true);
    setMessage(null);
    setIsError(false);

    try {
      const response = await fetch('/api/admin-approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookId, orderId }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle specific conflict error for already approved
        if (response.status === 409) {
          setMessage(result.message || 'Book is already approved.');
          setIsError(true); // Treat as an error/warning for UI feedback
        } else {
          throw new Error(result.error || `HTTP error! status: ${response.status}`);
        }
      } else {
        setMessage(result.message || 'Admin approval successful, print job triggered!');
        setIsError(false);
      }

    } catch (error: any) {
      console.error('Failed to trigger admin approval:', error);
      setMessage(`Error: ${error.message || 'Failed to trigger admin approval.'}`);
      setIsError(true);
    } finally {
      setIsLoading(false);
      // Optional: clear message after a few seconds
      setTimeout(() => setMessage(null), 5000);
    }
  };

  // Disable button if orderId is missing or if loading
  const isDisabled = !orderId || isLoading;

  return (
    <div>
      <button
        onClick={handleAdminApprove}
        disabled={isDisabled}
        className={`px-4 py-3 rounded-lg text-sm font-semibold text-white transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 w-full
          ${isDisabled
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-orange-600 hover:bg-orange-700'
          }
        `}
      >
        {isLoading ? 'Approving...' : 'Admin Approve & Print'}
      </button>
      {message && (
        <p className={`mt-2 text-xs ${isError ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </p>
      )}
    </div>
  );
} 