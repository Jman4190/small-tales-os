// /components/image-carousel.tsx
'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn } from "@/lib/utils"

interface CarouselImage {
  url: string
  alt: string
  width: number
  height: number
  priority?: boolean
  sizes?: string
}

interface ImageCarouselProps {
  images: CarouselImage[]
  priority?: boolean
  sizes?: string
  loading?: 'eager' | 'lazy'
}

export function ImageCarousel({ images, priority = false, sizes, loading = 'eager' }: ImageCarouselProps) {
  const [selectedImage, setSelectedImage] = useState(0)

  // Determine loading behavior for the main image
  // When priority is true (first image), use priority loading
  // Otherwise, use eager loading to avoid lazy loading above-fold content
  const isFirstImage = selectedImage === 0
  const shouldPrioritize = isFirstImage && priority

  return (
    <div className="w-full space-y-2">
      <div className="relative aspect-[4/3] w-full max-w-xl mx-auto overflow-hidden rounded-lg" style={{ contain: 'layout style paint' }}>
        <Image
          src={images[selectedImage].url}
          alt={images[selectedImage].alt}
          fill
          className="object-cover"
          priority={shouldPrioritize}
          fetchPriority={shouldPrioritize ? "high" : "auto"}
          loading={shouldPrioritize ? undefined : loading}
          sizes={sizes || "(max-width: 1280px) 100vw, 36rem"}
          quality={95}
        />
      </div>
      <div className="grid grid-cols-4 gap-2 max-w-xl mx-auto">
        {images.map((image, index) => (
          <button
            key={index}
            onClick={() => setSelectedImage(index)}
            className={cn(
              "relative aspect-[4/3] overflow-hidden rounded-md",
              selectedImage === index && "ring-2 ring-primary ring-offset-2"
            )}
          >
            <Image
              src={image.url}
              alt={image.alt}
              width={image.width}
              height={image.height}
              sizes="(max-width: 1280px) 25vw, 9rem"
              priority={false}
              loading="lazy"
              quality={75}
              className="object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  )
}

