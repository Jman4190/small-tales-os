'use client';

import { useState } from 'react';

interface ResendApprovalButtonProps {
  bookId: string;
  orderId: string | null; // Allow null for initial loading state
}

export default function ResendApprovalButton({ bookId, orderId }: ResendApprovalButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const handleResendApproval = async () => {
    if (!bookId || !orderId) {
      setMessage('Cannot resend approval without Book ID and Order ID.');
      setIsError(true);
      return;
    }

    setIsLoading(true);
    setMessage(null);
    setIsError(false);

    try {
      const response = await fetch('/api/resend-approval', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookId, orderId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      setMessage(result.message || 'Preview email queued for resend!');
      setIsError(false);
    } catch (error: any) {
      console.error('Failed to trigger resend approval:', error);
      setMessage(`Error: ${error.message || 'Failed to trigger resend.'}`);
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
        onClick={handleResendApproval}
        disabled={isDisabled}
        className={`px-4 py-3 rounded-lg text-sm font-semibold text-white transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 w-full
          ${isDisabled
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700'
          }
        `}
      >
        {isLoading ? 'Sending...' : 'Send for Approval Again'}
      </button>
      {message && (
        <p className={`mt-2 text-xs ${isError ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </p>
      )}
    </div>
  );
} 