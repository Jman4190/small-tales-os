// /components/features.tsx
"use client";

import Image from 'next/image'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import useEmblaCarousel from 'embla-carousel-react'

const features = [
  {
    title: "Just one image upload makes your child the star",
    description: "Once you upload one clear image of your child, our AI magic will convert their likeness into the book's main character.",
    image: {
      src: "/release-placeholder.svg",
      width: 1200,
      height: 800,
    },
    buttonText: "See Photo Examples",
  },
  {
    title: "The perfect bedtime story",
    description: "Our story artist put her heart and soul into this story. We guarantee your child will love it!",
    image: {
      src: "/release-placeholder.svg",
      width: 1200,
      height: 800,
    },
    buttonText: "Read a Sample Book",
  }
]

const photoExamples = [
  "/release-placeholder.svg",
  "/release-placeholder.svg",
  "/release-placeholder.svg",
  "/release-placeholder.svg",
  "/release-placeholder.svg",
]

const CarouselDots = ({ selectedIndex, itemsLength, onClick }: { selectedIndex: number, itemsLength: number, onClick: (index: number) => void }) => (
  <div className="flex justify-center gap-2 mt-4">
    {Array.from({ length: itemsLength }).map((_, i) => (
      <button
        key={i}
        onClick={() => onClick(i)}
        className="p-2"
        aria-label={`Go to slide ${i + 1}`}
        aria-current={selectedIndex === i ? 'true' : undefined}
      >
        <span
          className={`block h-2 w-2 rounded-full transition-colors ${
            selectedIndex === i ? 'bg-primary' : 'bg-gray-300'
          }`}
        />
      </button>
    ))}
  </div>
)

const ImageCarousel = ({ images }: { images: string[] }) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: true,
    startIndex: 0
  })
  const [selectedIndex, setSelectedIndex] = useState(0)

  const scrollTo = useCallback((index: number) => {
    emblaApi?.scrollTo(index)
    setSelectedIndex(index)
  }, [emblaApi])

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi])
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi])

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    onSelect()
    emblaApi.on('select', onSelect)
    return () => {
      emblaApi.off('select', onSelect)
    }
  }, [emblaApi, onSelect])

  return (
    <div className="relative group">
      <div className="overflow-hidden rounded-lg" ref={emblaRef}>
        <div className="flex">
          {images.map((src, i) => (
            <div key={i} className="relative w-full flex-[0_0_100%] aspect-[4/3]">
              <Image
                src={src}
                alt={`Carousel image ${i + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
                quality={85}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Arrow Buttons - only visible on hover on desktop */}
      <button 
        onClick={scrollPrev}
        className="absolute left-0 -translate-x-1/2 top-1/2 -translate-y-1/2 w-14 h-14 flex items-center justify-center rounded-full bg-white/80 shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-white hidden md:flex"
        aria-label="Previous slide"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button 
        onClick={scrollNext}
        className="absolute right-0 translate-x-1/2 top-1/2 -translate-y-1/2 w-14 h-14 flex items-center justify-center rounded-full bg-white/80 shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-white hidden md:flex"
        aria-label="Next slide"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      <CarouselDots
        selectedIndex={selectedIndex}
        itemsLength={images.length}
        onClick={scrollTo}
      />
    </div>
  )
}

export function Features() {
  return (
    <section className="w-full py-8 sm:py-12">
      <div className="container px-4 mx-auto">
        {features.map((feature, index) => (
          <div key={index} className={`flex flex-col ${index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} gap-10 lg:items-center mb-12 lg:mb-16`}>
            <div className="flex-1">
              {index === 0 ? (
                <ImageCarousel images={[
                  "/release-placeholder.svg",
                  "/release-placeholder.svg",
                  "/release-placeholder.svg",
                ]} />
              ) : (
                <ImageCarousel images={[
                  "/release-placeholder.svg",
                  "/release-placeholder.svg",
                  "/release-placeholder.svg",
                ]} />
              )}
            </div>
            <div className="flex gap-6 flex-col flex-1">
              <div className="space-y-4">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-heading font-bold tracking-tight">
                  {feature.title}
                </h2>
                <p className="text-base sm:text-lg text-muted-foreground max-w-xl font-sans">
                  {feature.description}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                {feature.buttonText === "See Photo Examples" ? (
                  <Button
                    asChild
                    variant="outline"
                    className="transition-transform duration-150 active:scale-[0.97] w-full sm:w-auto"
                  >
                    <a href="/photo-examples">See Photo Examples</a>
                  </Button>
                ) : (
                  <Button
                    asChild
                    variant="outline"
                    className="transition-transform duration-150 active:scale-[0.97] w-full sm:w-auto"
                  >
                    <a href="/book-sample">{feature.buttonText}</a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

