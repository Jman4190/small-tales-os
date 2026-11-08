'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { updateImageUrl, BookPhoto } from '@/lib/supabaseAdminActions';
import ImageConfirmationModal from './ImageConfirmationModal'; // Import the new modal

// Updated SVG Copy Icon (Clipboard style)
const CopyIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-4 h-4"}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
  </svg>
);

// Simple SVG Check Icon component
const CheckIcon = ({ className }: { className?: string }) => (
   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-4 h-4"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
   </svg>
);

interface ImageEditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  photo: BookPhoto | null; // Can be null when closed
  prompt: string | null; // The formatted prompt
  bookId: string;
  orderId: string;
  onUpdateAction: typeof updateImageUrl; // The server action function
}

export default function ImageEditDrawer({
  isOpen,
  onClose,
  photo,
  prompt,
  bookId,
  orderId,
  onUpdateAction,
}: ImageEditDrawerProps) {
  const router = useRouter();
  const [newImageUrl, setNewImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false); // Now used for the *confirmation* step
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false); // State for copy feedback
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false); // State for confirmation modal

  // Reset state when the drawer opens with a new photo
  useEffect(() => {
    if (isOpen && photo) {
      setNewImageUrl(photo.image_url); // Use current photo URL as default
      setError(null);
      setSuccess(false);
      setIsSubmitting(false);
      setCopied(false); // Reset copied state
      setIsConfirmModalOpen(false); // Ensure modal is closed initially
    } else if (!isOpen) {
      // Optional: Clear state when drawer closes
      // Resetting relevant states might be good practice
      setNewImageUrl('');
      setError(null);
      setSuccess(false);
      setIsSubmitting(false);
      setIsConfirmModalOpen(false);
    }
  }, [isOpen, photo]);

  // This now just opens the confirmation modal
  const handleSaveChangesClick = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!photo || newImageUrl === photo.image_url || !newImageUrl) return; // Basic validation

    setError(null); // Clear previous errors before showing modal
    setSuccess(false);
    setIsConfirmModalOpen(true);
  };

  // This function performs the actual update after confirmation
  const handleConfirmUpdate = async () => {
    if (!photo) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await onUpdateAction(
        photo.id,
        newImageUrl,
        photo.image_url, // Pass original URL for logging/comparison
        bookId,
        orderId
      );

      if (result.success) {
        setSuccess(true);
        setIsConfirmModalOpen(false); // Close modal on success
        router.refresh();
        setTimeout(() => {
          onClose(); // Close drawer after a short delay
        }, 1500);
      } else {
        const errorMessage = (result as any)?.error || 'Update action failed.';
        setError(errorMessage);
        setIsConfirmModalOpen(false); // Close modal even on error to show msg in drawer
      }
    } catch (err: any) {
      console.error('Failed to update image URL:', err);
      setError(err.message || 'An unexpected error occurred.');
      setIsConfirmModalOpen(false); // Close modal on catch
    } finally {
      setIsSubmitting(false); // Ensure submitting state is reset
    }
  };

  // Handle closing via Escape key (closes modal first, then drawer)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isConfirmModalOpen) {
          setIsConfirmModalOpen(false);
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    } else {
      document.removeEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, isConfirmModalOpen]);

  // Function to copy prompt to clipboard
  const handleCopyPrompt = async () => {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      // Reset copied state after a short delay
      setTimeout(() => setCopied(false), 2000); // Show feedback for 2 seconds
    } catch (err) {
      console.error('Failed to copy prompt:', err);
      // Optionally show an error message to the user
    }
  };

  // Determine if Save button should be disabled
  const isSaveDisabled = !photo || newImageUrl === photo.image_url || !newImageUrl || isSubmitting;

  return (
    <>
      {/* Overlay - Drawer */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose} // Close drawer if overlay is clicked
      ></div>

      {/* Drawer */}
      <div
        className={`fixed top-16 right-0 h-[calc(100vh-4rem)] w-full max-w-xl bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex justify-between items-center p-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold">Update Image URL</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              aria-label="Close drawer"
            >
              &times;
            </button>
          </div>

          {/* Content */}
          <div className="flex-grow p-6 overflow-y-auto">
            {!photo ? (
              <p>Loading photo details...</p>
            ) : (
              // Point the form submission to the new handler
              <form onSubmit={handleSaveChangesClick} id="edit-image-form">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ref Number:
                  </label>
                  <p className="text-sm text-gray-900 font-medium bg-gray-100 px-3 py-2 rounded-md">
                    {photo.image_reference_number ?? 'N/A'}
                  </p>
                </div>

                {/* Add Photo ID (UUID) Display */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Photo ID (UUID):
                  </label>
                  <p className="text-xs text-gray-900 font-mono bg-gray-100 px-3 py-2 rounded-md break-all">
                    {photo.id}
                  </p>
                </div>

                <div className="mb-4">
                   {/* Prompt Section - Label and Copy Button Inline */}
                   <div className="flex items-center mb-1">
                        <label className="block text-sm font-medium text-gray-700 mr-2">
                            Prompt:
                        </label>
                        <button
                            type="button"
                            onClick={handleCopyPrompt}
                            className="text-gray-400 hover:text-indigo-600 transition-colors duration-150 p-1 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
                            title="Copy Prompt"
                        >
                            {copied ? (
                                <span className="flex items-center text-xs text-green-600">
                                    <CheckIcon className="w-3 h-3 mr-1" /> Copied!
                                </span>
                            ) : (
                                <CopyIcon className="w-3 h-3" /> // Make icon slightly smaller
                            )}
                        </button>
                    </div>
                  <p className="text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded-md whitespace-pre-wrap break-words">
                    {prompt ?? 'Prompt not available.'}
                  </p>
                </div>

                <div className="mb-4">
                  <label htmlFor="imageUrl" className="block text-sm font-medium text-gray-700 mb-1">
                    Current Image URL:
                  </label>
                  <input
                    type="url"
                    id="imageUrl"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
                    disabled={isSubmitting}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                     Original URL: <a href={photo.image_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">{photo.image_url}</a>
                  </p>
                </div>

                {error && <p className="text-red-500 text-sm mb-3">Error: {error}</p>}
                {success && <p className="text-green-600 text-sm mb-3">Image URL update confirmed!</p>}
              </form>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center p-4 border-t border-gray-200 bg-gray-50">
            {/* Leonardo.ai Link Button */}
            <a
              href="https://app.leonardo.ai/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Go to Leonardo.ai
            </a>

            {/* Existing Buttons */} 
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting} // Disable cancel if confirm is in progress
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-image-form" // Link button to the form
                disabled={isSaveDisabled} // Use updated disable logic
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:bg-indigo-300"
              >
                 {/* Text doesn't need to change based on isSubmitting here */}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal Render */} 
      {photo && (
        <ImageConfirmationModal
          isOpen={isConfirmModalOpen}
          onClose={() => setIsConfirmModalOpen(false)} // Simple close handler
          onConfirm={handleConfirmUpdate} // Call the actual update handler
          originalImageUrl={photo.image_url}
          newImageUrl={newImageUrl}
          isSaving={isSubmitting} // Pass submitting state to modal
        />
      )}
    </>
  );
} 