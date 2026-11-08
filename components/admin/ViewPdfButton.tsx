'use client';

import React, { useState } from 'react';

interface ViewPdfButtonProps {
  orderId: string | null;
  initialPdfUrl: string | null; // The possibly expired URL, used for initial display
}

export default function ViewPdfButton({ orderId, initialPdfUrl }: ViewPdfButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleViewPdf = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault(); // Prevent default link behavior if it were a link
    if (!orderId) {
      setError('Missing Order ID');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/refresh-signed-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filePath: initialPdfUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const { signedUrl } = await response.json();

      if (!signedUrl) {
        throw new Error('No signed URL received from API');
      }

      // Open the new signed URL in a new tab
      window.open(signedUrl, '_blank', 'noopener,noreferrer');

    } catch (err: any) {
      console.error('Error fetching signed URL:', err);
      setError(err.message || 'Failed to fetch PDF URL. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Disable button if no initial URL or orderId is present
  const isDisabled = !initialPdfUrl || !orderId;

  return (
    <div className="mb-4">
      <button
        onClick={handleViewPdf}
        disabled={isDisabled || isLoading}
        className={`text-sm text-blue-600 hover:underline ${isDisabled ? 'cursor-not-allowed text-gray-400 hover:no-underline' : ''} ${isLoading ? 'opacity-75' : ''}`}
      >
        {isLoading ? 'Loading PDF...' : 'View Current PDF →'}
      </button>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      {isDisabled && !orderId && <p className="text-xs text-gray-500 mt-1">Cannot view PDF without an Order ID.</p>}
      {isDisabled && !initialPdfUrl && orderId && <p className="text-xs text-gray-500 mt-1">No PDF URL found for this order.</p>}
    </div>
  );
} 