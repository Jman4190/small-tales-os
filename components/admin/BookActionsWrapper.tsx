'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { triggerPdfRegeneration, getUpdatedPdfUrl } from '@/lib/supabaseAdminActions';

interface BookActionsWrapperProps {
  bookId: string;
  orderId: string;
  triggerAction: typeof triggerPdfRegeneration;
  pollAction: typeof getUpdatedPdfUrl;
}

type PollStatus = 'idle' | 'triggering' | 'polling' | 'success' | 'error' | 'timeout';

const POLLING_INTERVAL = 5000; // Poll every 5 seconds
const POLLING_TIMEOUT = 60000; // Stop polling after 60 seconds

export default function BookActionsWrapper({
  bookId,
  orderId,
  triggerAction,
  pollAction,
}: BookActionsWrapperProps) {
  const [status, setStatus] = useState<PollStatus>('idle');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollIntervalId, setPollIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [pollTimeoutId, setPollTimeoutId] = useState<NodeJS.Timeout | null>(null);

  // Function to stop polling and clear timers
  const stopPolling = useCallback(() => {
    if (pollIntervalId) clearInterval(pollIntervalId);
    if (pollTimeoutId) clearTimeout(pollTimeoutId);
    setPollIntervalId(null);
    setPollTimeoutId(null);
  }, [pollIntervalId, pollTimeoutId]);

  // Cleanup polling on component unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  // Function to handle the polling logic
  const pollForPdf = useCallback(async () => {
    console.log(`Polling for PDF for order ${orderId}...`);
    try {
      const result = await pollAction(orderId);
      if (result.found && result.pdfUrl) {
        console.log(`PDF found: ${result.pdfUrl}`);
        setPdfUrl(result.pdfUrl);
        setStatus('success');
        stopPolling();
      } else if (!result.found) {
        console.warn(`Order ${orderId} not found during polling.`);
        setError('Order not found during polling process.');
        setStatus('error');
        stopPolling();
      } else {
        // Still polling, pdfUrl is null but order was found
        setStatus('polling'); // Keep status as polling
      }
    } catch (err: any) {
      console.error('Error during polling:', err);
      setError(err.message || 'An error occurred while polling for the PDF.');
      setStatus('error');
      stopPolling();
    }
  }, [orderId, pollAction, stopPolling]);

  // Function to trigger PDF regeneration
  const handleTriggerPdf = async () => {
    setStatus('triggering');
    setError(null);
    setPdfUrl(null);
    stopPolling(); // Clear any previous polling

    try {
      const triggerResult = await triggerAction(bookId);
      if (triggerResult.success) {
        console.log(`Triggered PDF regeneration for order ${triggerResult.orderId}`);
        setStatus('polling');

        // Start polling immediately
        pollForPdf(); // Initial check
        const intervalId = setInterval(pollForPdf, POLLING_INTERVAL);
        setPollIntervalId(intervalId);

        // Set a timeout for the polling
        const timeoutId = setTimeout(() => {
          console.warn('Polling timed out.');
          if (status === 'polling') { // Only set timeout status if still polling
            setStatus('timeout');
            setError('Polling timed out. The PDF may still be generating.');
            stopPolling();
          }
        }, POLLING_TIMEOUT);
        setPollTimeoutId(timeoutId);

      } else {
        // Should not happen if action throws error, but handle defensively
        throw new Error('Trigger action failed silently.');
      }
    } catch (err: any) {
      console.error('Failed to trigger PDF regeneration:', err);
      setError(err.message || 'Failed to start PDF regeneration.');
      setStatus('error');
      stopPolling();
    }
  };

  return (
    <div className="p-4 border rounded-md shadow-sm bg-gray-50 mb-6">
      <h3 className="text-lg font-semibold mb-3">Book Actions</h3>
      <div className="flex items-center space-x-4">
        <button
          onClick={handleTriggerPdf}
          disabled={status === 'triggering' || status === 'polling'}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
        >
          Regenerate Admin PDF
        </button>
        <div className="text-sm">
          {status === 'idle' && <p>Click to generate a new admin PDF.</p>}
          {status === 'triggering' && <p className="text-blue-600">Sending request...</p>}
          {status === 'polling' && <p className="text-blue-600">Polling for generated PDF...</p>}
          {status === 'success' && pdfUrl && (
            <div className="text-green-700">
              <p className="font-medium">PDF Ready!</p>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-green-800"
              >
                Download PDF
              </a>
            </div>
          )}
          {status === 'error' && <p className="text-red-600">Error: {error || 'An unknown error occurred.'}</p>}
          {status === 'timeout' && <p className="text-orange-600">Timeout: {error || 'PDF generation took too long.'}</p>}
        </div>
      </div>
    </div>
  );
}
