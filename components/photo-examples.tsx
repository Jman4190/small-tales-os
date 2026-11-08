"use client"

import { useState, useCallback, useEffect } from "react"
import AutoScroll from "embla-carousel-auto-scroll"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi
} from "@/components/ui/carousel"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface PhotoExample {
  id: string
  description: string
  image: string
}

const photoExamples: PhotoExample[] = [
  {
    id: "photo-1",
    description: "Personalized children's book cover",
    image: "/release-placeholder.svg",
  },
  {
    id: "photo-2",
    description: "Child as racecar driver",
    image: "/release-placeholder.svg",
  },
  {
    id: "photo-3",
    description: "Child as pilot",
    image: "/release-placeholder.svg",
  },
  {
    id: "photo-4",
    description: "Child as astronaut",
    image: "/release-placeholder.svg",
  },
  {
    id: "photo-5",
    description: "Child as rockstar",
    image: "/release-placeholder.svg",
  },
  {
    id: "photo-6",
    description: "Child as master chef",
    image: "/release-placeholder.svg",
  },
  {
    id: "photo-7",
    description: "Child as olympic sprinter",
    image: "/release-placeholder.svg",
  },
  {
    id: "photo-8",
    description: "Child in front of school house",
    image: "/release-placeholder.svg",
  },
  {
    id: "photo-9",
    description: "Child surfing with dolphin",
    image: "/release-placeholder.svg",
  },
  {
    id: "photo-10",
    description: "Child as scientist",
    image: "/release-placeholder.svg",
  },
  {
    id: "photo-11",
    description: "Child as firefighter",
    image: "/release-placeholder.svg",
  },
  {
    id: "photo-12",
    description: "Child running down the sidewalk on autumn day",
    image: "/release-placeholder.svg",
  },
]

export function PhotoExamples() {
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (!api) return
    
    const onSelect = () => {
      setCurrent(api.selectedScrollSnap())
    }
    
    api.on("select", onSelect)
    // Initial call to set the current index
    onSelect()
    
    return () => {
      api.off("select", onSelect)
    }
  }, [api])

  const handleDotClick = (index: number) => {
    if (api) {
      api.scrollTo(index)
    }
  }

  return (
    <section className="py-8 sm:py-16">
      <div className="container px-4 mx-auto">
        <h2 className="text-2xl sm:text-4xl font-heading font-bold text-center mb-8 sm:mb-12">
          Meet the characters included in your book
        </h2>
        
        <div className="relative">
          <Carousel
            opts={{ 
              loop: true,
              align: "start",
            }}
            plugins={[
              AutoScroll({ 
                playOnInit: true,
                speed: 1.5,
              })
            ]}
            className="mb-4"
            setApi={setApi}
          >
            <CarouselContent className="-ml-4">
              {photoExamples.map((photo) => (
                <CarouselItem
                  key={photo.id}
                  className="pl-4 basis-full sm:basis-1/2 md:basis-1/3"
                >
                  <div className="relative aspect-square w-full overflow-hidden rounded-lg">
                    <Image
                      src={photo.image}
                      alt={photo.description}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      quality={75}
                      loading="lazy"
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
          
          {/* Mobile dot indicators */}
          <div className="flex justify-center gap-1.5 mt-4 sm:hidden">
            {photoExamples.map((photo, index) => (
              <button
                key={`dot-${photo.id}`}
                className="p-2"
                onClick={() => handleDotClick(index)}
                aria-label={`Go to slide ${index + 1}`}
                aria-current={current === index ? 'true' : undefined}
              >
                <span
                  className={cn(
                    "block w-2 h-2 rounded-full transition-colors",
                    current === index ? "bg-primary" : "bg-gray-300"
                  )}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
