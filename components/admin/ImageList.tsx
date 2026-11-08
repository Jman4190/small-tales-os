'use client';

import React, { useState } from 'react';
import Image from 'next/image'; // Use Next.js Image for optimization
import ImageEditDrawer from './ImageEditDrawer'; // Import the drawer component
// Import the type for the server action and the shared BookPhoto type
import type { updateImageUrl, BookPhoto } from '@/lib/supabaseAdminActions';

// Simple SVG Pencil Icon component
const PencilIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-4 h-4"}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
  </svg>
);

// Define the type for a single photo, mirroring the server component
/* // REMOVED type definition
type BookPhoto = {
  id: string; // Corrected: PK is uuid -> string
  book_id: string;
  order_id: string;
  image_url: string;
  image_reference_number: string | null; // Corrected: Column name and type (text)
  created_at: string;
  updated_at: string | null;
  // Add other potentially relevant fields
  character_name?: string | null;
  status?: string;
  character_gender?: string | null;
  reference_image_url?: string | null;
};
*/

interface ImageListProps {
  photos: BookPhoto[];
  bookId: string;
  orderId: string;
  updateImageUrlAction: typeof updateImageUrl; // Pass the server action function as a prop
}

export default function ImageList({ photos, bookId, orderId, updateImageUrlAction }: ImageListProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<BookPhoto | null>(null);

  const handleEditClick = (photo: BookPhoto) => {
    setSelectedPhoto(photo);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPhoto(null);
  };

  if (!photos || photos.length === 0) {
    return <p className="text-gray-500">No photos found for this book.</p>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {photos.map((photo) => (
        <div key={photo.id} className="border rounded-lg overflow-hidden shadow-sm">
          <div className="relative w-full h-40"> {/* Fixed height container */}
            <Image
              src={photo.image_url} // Use the photo URL from Supabase
              alt={`Book photo ${photo.image_reference_number ?? photo.id}`} // Corrected field
              layout="fill" // Fill the container
              objectFit="cover" // Cover the area, cropping if necessary
              className="transition-transform duration-200 ease-in-out hover:scale-105"
              // Add placeholder and error handling if desired
              // placeholder="blur"
              // blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
            />
          </div>
          <div className="p-4 bg-gray-50"> {/* Increased padding */}
            <p className="text-xs text-gray-600 mb-1">
              Ref: {photo.image_reference_number ?? 'N/A'} {/* Corrected field */}
            </p>
            {/* Optionally display ID: <p className="text-xs text-gray-500">ID: {photo.id}</p> */}
            <button
              onClick={() => handleEditClick(photo)}
              className="w-full text-sm bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50 flex items-center justify-center" // Removed mt-1, increased text/padding, added flex centering
            >
              <PencilIcon className="w-4 h-4 mr-2" /> {/* Added icon */}
              Edit URL
            </button>
          </div>
        </div>
      ))}

      {isModalOpen && selectedPhoto && (
        <ImageEditDrawer
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          photo={selectedPhoto}
          prompt={null} // Pass null for prompt as it's not available here
          bookId={bookId}
          orderId={orderId}
          onUpdateAction={updateImageUrlAction} // Pass the server action down
        />
      )}
    </div>
  );
}
