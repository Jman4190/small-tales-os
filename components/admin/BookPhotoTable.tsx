'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import ImageEditDrawer from '@/components/admin/ImageEditDrawer';
import type { updateImageUrl, BookPhoto } from '@/lib/supabaseAdminActions'; // Use imported types
import { IMAGE_REFERENCES } from '@/config/imageReferences'; // Import the prompts config

// Helper function to extract number from reference string (e.g., "image_10" -> 10)
const extractNumber = (ref: string | null | undefined): number => {
  if (!ref) return Infinity; // Sort items without ref number last
  const match = ref.match(/\d+$/);
  return match ? parseInt(match[0], 10) : Infinity;
};

interface BookPhotoTableProps {
  photos: BookPhoto[];
  bookId: string;
  orderId: string;
  updateImageUrlAction: typeof updateImageUrl;
  // Add props for book details needed for prompts
  age: number | null;
  gender: string | null;
  appearance: {
    skinTone?: string | null;
    hair?: string | null;
    eyeColor?: string | null;
  } | null;
}

// Define the type for the sort key
type SortableKeys = keyof BookPhoto | 'image_reference_number_num' | 'prompt';

// Helper to get the formatted prompt for a given image reference number
const getFormattedPrompt = (
    imageRefNum: string | null | undefined,
    age: number | null,
    gender: string | null,
    appearance: BookPhotoTableProps['appearance']
): string => {
    if (!imageRefNum) return 'Prompt not available.';

    const reference = IMAGE_REFERENCES.find(ref => ref.image_number === imageRefNum);
    if (!reference) return 'Base prompt not found.';

    let prompt = reference.prompt;
    // Replace placeholders with actual data, using defaults if data is missing
    prompt = prompt.replace('{age}', age?.toString() || '[age]');
    prompt = prompt.replace('{gender}', gender || '[gender]');
    prompt = prompt.replace('{appearance.skinTone}', appearance?.skinTone || 'default');
    prompt = prompt.replace('{appearance.hair}', appearance?.hair || 'default hair');
    prompt = prompt.replace('{appearance.eyeColor}', appearance?.eyeColor || 'blue');

    return prompt;
};

export default function BookPhotoTable({
    photos,
    bookId,
    orderId,
    updateImageUrlAction,
    // Destructure new props
    age,
    gender,
    appearance
}: BookPhotoTableProps) {
  const [filter, setFilter] = useState('');
  const [filteredPhotos, setFilteredPhotos] = useState<BookPhoto[]>(photos);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<BookPhoto | null>(null);
  const [selectedPhotoPrompt, setSelectedPhotoPrompt] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'ascending' | 'descending' } | null>({
    key: 'image_reference_number_num',
    direction: 'ascending'
  });

  useEffect(() => {
    setFilteredPhotos(
      photos.filter((photo) =>
        photo.image_reference_number?.toLowerCase().includes(filter.toLowerCase())
        // Optionally, add prompt text to the filter?
        // || getFormattedPrompt(photo.image_reference_number, age, gender, appearance).toLowerCase().includes(filter.toLowerCase())
      )
    );
  }, [filter, photos, age, gender, appearance]); // Add dependencies

  // Sort photos based on sortConfig
  const sortedPhotos = useMemo(() => {
    let sortableItems = [...filteredPhotos];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        // Use the type-safe sortConfig.key
        switch (sortConfig.key) {
          case 'image_reference_number_num':
            aValue = extractNumber(a.image_reference_number);
            bValue = extractNumber(b.image_reference_number);
            break;
          case 'prompt':
            aValue = getFormattedPrompt(a.image_reference_number, age, gender, appearance);
            bValue = getFormattedPrompt(b.image_reference_number, age, gender, appearance);
            break;
          // Handle actual BookPhoto keys if needed in the future
          // default:
          //   if (sortConfig.key in a && sortConfig.key in b) {
          //       aValue = a[sortConfig.key as keyof BookPhoto];
          //       bValue = b[sortConfig.key as keyof BookPhoto];
          //   } else {
          //       return 0; // Cannot compare if key doesn't exist
          //   }
          //   break;
          default:
             // If the key is a valid BookPhoto key but not explicitly handled, try accessing it.
             // This part remains tricky if keys overlap with 'image_reference_number_num' or 'prompt'.
             // For now, focusing on the requested sort keys.
             try {
                // Check if the key exists on the photo object before accessing
                if (sortConfig.key in a && sortConfig.key in b) {
                    aValue = a[sortConfig.key as keyof BookPhoto];
                    bValue = b[sortConfig.key as keyof BookPhoto];
                } else {
                    return 0; // Key not found on objects, cannot sort
                }
             } catch (e) {
                 console.warn("Error accessing sort key:", sortConfig.key, e);
                 return 0;
             }
             break;
        }

        // Basic comparison
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          aValue = aValue.toLowerCase();
          bValue = bValue.toLowerCase();
        }
        // Handle potential null/undefined gracefully if needed, depends on data
        if (aValue === null || aValue === undefined) aValue = sortConfig.direction === 'ascending' ? Infinity : -Infinity;
        if (bValue === null || bValue === undefined) bValue = sortConfig.direction === 'ascending' ? Infinity : -Infinity;


        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredPhotos, sortConfig, age, gender, appearance]); // Add dependencies

  // Function to request sorting - Use SortableKeys type
  const requestSort = (key: SortableKeys) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction }); // No cast needed now
  };

  // Get sorting indicator for table header - Use SortableKeys type
   const getSortIndicator = (key: SortableKeys) => {
    if (!sortConfig || sortConfig.key !== key) {
      return null;
    }
    return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
   };

  const handleEditClick = useCallback((photo: BookPhoto) => {
    setSelectedPhoto(photo);
    const prompt = getFormattedPrompt(photo.image_reference_number, age, gender, appearance);
    setSelectedPhotoPrompt(prompt);
    setIsDrawerOpen(true);
  }, [age, gender, appearance]);

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setSelectedPhoto(null);
    setSelectedPhotoPrompt(null);
  }, []);

  return (
    <section className="bg-gray-50 antialiased">
      <div className="mx-auto w-full">
        <div className="bg-white relative shadow-md sm:rounded-lg overflow-hidden border border-gray-200">
          <div className="flex flex-col md:flex-row items-center justify-between space-y-3 md:space-y-0 md:space-x-4 p-4">
            <div className="w-full md:w-1/2">
              <form className="flex items-center">
                <label htmlFor="photo-search" className="sr-only">Search by Ref Number</label>
                <div className="relative w-full">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <svg aria-hidden="true" className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    id="photo-search"
                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 p-2 placeholder-gray-400"
                    placeholder="Search by reference number"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                </div>
              </form>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                <tr>
                  <th scope="col" className="px-4 py-3">Preview</th>
                  {/* Ref Number Column (Moved to 2nd) */}
                  <th scope="col" className="px-4 py-3 cursor-pointer hover:bg-gray-200" onClick={() => requestSort('image_reference_number_num')}>
                    Ref Number
                    {getSortIndicator('image_reference_number_num')}
                  </th>
                  {/* Prompt Column (Replaced Character) - Wider */}
                  <th scope="col" className="px-4 py-3 cursor-pointer hover:bg-gray-200 w-1/2" onClick={() => requestSort('prompt')}>
                    Prompt
                    {getSortIndicator('prompt')}
                  </th>
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedPhotos.length === 0 ? (
                  <tr className="border-b">
                     <td colSpan={4} className="px-4 py-3 text-center text-gray-500">
                       No photos found {filter ? 'matching your filter' : 'for this book'}.
                     </td>
                  </tr>
                ) : (
                  sortedPhotos.map((photo) => (
                    <tr key={photo.id} className="border-b hover:bg-gray-50">
                      {/* Preview Cell */}
                      <td className="px-4 py-2 align-middle">
                        <div className="relative w-24 h-24">
                          <Image
                            src={photo.image_url}
                            alt={`Preview ${photo.image_reference_number ?? photo.id}`}
                            layout="fill"
                            objectFit="cover"
                            className="rounded"
                          />
                        </div>
                      </td>
                      {/* Ref Number Cell */}
                      <td className="px-4 py-3 align-middle font-medium text-gray-900 whitespace-nowrap">{photo.image_reference_number ?? 'N/A'}</td>
                      {/* Prompt Cell */}
                      <td className="px-4 py-3 align-middle">{getFormattedPrompt(photo.image_reference_number, age, gender, appearance)}</td>
                      {/* Action Cell - Triggers handleEditClick */}
                      <td className="px-4 py-3 flex items-center justify-end align-middle">
                        <button
                          onClick={() => handleEditClick(photo)}
                          className="px-3 py-1 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ImageEditDrawer
          isOpen={isDrawerOpen}
          onClose={handleCloseDrawer}
          photo={selectedPhoto}
          prompt={selectedPhotoPrompt}
          bookId={bookId}
          orderId={orderId}
          onUpdateAction={updateImageUrlAction}
        />
    </section>
  );
} 