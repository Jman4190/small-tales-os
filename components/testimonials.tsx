'use client'

// /components/testimonials.tsx
import { Testimonial } from "@/components/ui/testimonial-card"
import useEmblaCarousel from 'embla-carousel-react'
import { useEffect, useState } from 'react'

const testimonials = [
  {
    name: "Jennifer Thompson",
    role: "Grandmother of 2",
    rating: 5,
    testimonial: "These stories have become cherished family keepsakes that we read together every visit."
  },
  {
    name: "Michael Rodriguez",
    role: "Father of 3",
    rating: 5,
    testimonial: "My kid could not stop smiling seeing himself as the main character. Genius!"
  },
  {
    name: "Sarah Chen",
    role: "Mother of 2",
    rating: 5,
    testimonial: "This is one of those read-every-night-before-bedtime-or-we'll-cry books!"
  }
]

export function Testimonials() {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: 'start',
    containScroll: 'trimSnaps'
  })

  return (
    <section className="py-8 sm:py-16 bg-background">
      <div className="container px-4 mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-heading font-bold text-center mb-10">
            What Parents & Grandparents Say
          </h2>
        </div>
        
        {/* Mobile Carousel */}
        <div className="md:hidden overflow-hidden" ref={emblaRef}>
          <div className="flex touch-pan-y">
            {testimonials.map((testimonial) => (
              <div 
                key={testimonial.name} 
                className="flex-[0_0_85%] min-w-0 mr-4 relative"
              >
                <Testimonial {...testimonial} />
              </div>
            ))}
          </div>
        </div>

        {/* Desktop Grid */}
        <div className="hidden md:grid gap-8 grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <Testimonial key={testimonial.name} {...testimonial} />
          ))}
        </div>

        {/* COMMENTED OUT - Stories carousel for future use
        <div className="flex justify-center">
          <Stories className="w-full max-w-6xl">
            <StoriesContent>
              {stories.map((story) => (
                <Story key={story.id}>
                  <div className="aspect-[9/16] w-[200px] sm:w-[240px]">
                    <StoryVideo src={story.video} />
                    <StoryOverlay />
                    <StoryAuthor>
                      <StoryAuthorImage
                        fallback={story.fallback}
                        name={story.author}
                        src={story.avatar}
                      />
                      <StoryAuthorName>{story.author}</StoryAuthorName>
                    </StoryAuthor>
                  </div>
                </Story>
              ))}
            </StoriesContent>
          </Stories>
        </div>
        */}
      </div>
    </section>
  )
}
