'use client';

import { useState } from 'react';

interface RegeneratePdfButtonProps {
  bookId: string;
  orderId: string | null; // Can be null if not found initially
  onPdfRegenerated?: () => void; // Optional callback when PDF is successfully regenerated
}

export default function RegeneratePdfButton({ bookId, orderId, onPdfRegenerated }: RegeneratePdfButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const handleRegenerate = async () => {
    if (!orderId) {
      setMessage('Cannot trigger regeneration without an Order ID.');
      setIsError(true);
      return;
    }

    setIsLoading(true);
    setMessage(null);
    setIsError(false);

    try {
      const response = await fetch('/api/regenerate-pdf', {
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

      setMessage(result.message || 'PDF regeneration successfully triggered!');
      setIsError(false);
      
      // Call the callback if provided
      if (onPdfRegenerated) {
        onPdfRegenerated();
      }
    } catch (error: any) {
      console.error('Failed to trigger PDF regeneration:', error);
      setMessage(`Error: ${error.message || 'Failed to trigger regeneration.'}`);
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
        onClick={handleRegenerate}
        disabled={isDisabled}
        className={`px-6 py-3 rounded-lg font-semibold text-white transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 w-full
          ${
            isDisabled
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }
        `}
      >
        {isLoading ? 'Regenerating PDF...' : 'Regenerate Production PDF'}
      </button>
      {message && (
        <p className={`mt-3 text-sm ${isError ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </p>
      )}
       {!orderId && (
         <p className="mt-3 text-sm text-red-600">
           Cannot trigger regeneration: Order ID is missing.
         </p>
       )}
    </div>
  );
} 