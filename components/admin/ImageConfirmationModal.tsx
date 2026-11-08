'use client';

import React from 'react';
import Image from 'next/image';

interface ImageConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void; // The function to call when confirmed
  originalImageUrl: string;
  newImageUrl: string;
  isSaving: boolean; // To show loading state on confirm button
}

const ImageConfirmationModal: React.FC<ImageConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  originalImageUrl,
  newImageUrl,
  isSaving,
}) => {
  if (!isOpen) return null;

  return (
    // Modal Overlay
    <div className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex justify-center items-center p-4 transition-opacity duration-300 ease-in-out">
      {/* Modal Content */}
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden transform transition-all duration-300 ease-in-out scale-100">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Confirm Image Update</h2>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none disabled:opacity-50"
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Before Image */}
          <div>
            <h3 className="text-md font-medium text-gray-700 mb-2">Before</h3>
            <div className="relative border border-gray-200 rounded overflow-hidden aspect-square bg-gray-50">
              <Image
                src={originalImageUrl}
                alt="Original image"
                fill
                className="object-contain"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
            </div>
          </div>

          {/* After Image */}
          <div>
            <h3 className="text-md font-medium text-gray-700 mb-2">After (New URL)</h3>
            <div className="relative border border-gray-200 rounded overflow-hidden aspect-square bg-gray-50">
              <Image
                src={newImageUrl}
                alt="Updated preview image"
                fill
                className="object-contain"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end items-center p-4 border-t border-gray-200 bg-gray-50 space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSaving}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:bg-indigo-300"
          >
            {isSaving ? 'Confirming...' : 'Confirm Update'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageConfirmationModal; 