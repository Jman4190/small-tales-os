// /components/how-it-works.tsx
"use client"

import { Card, CardContent } from "@/components/ui/card"

const steps = [
  {
    title: "Upload One Photo",
    description: "Upload a clear photo to get started",
  },
  {
    title: "Preview Your Character",
    description: "Get a sneak peek of your character",
  },
  {
    title: "Order Your Book",
    description: "Place a secure online order",
  },
  {
    title: "Approve Before Printing",
    description: "Approve your PDF before it prints",
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-4 sm:py-8 bg-background">
      <div className="container px-4 mx-auto">
        <h2 className="text-3xl sm:text-4xl font-heading font-bold text-center mb-6">
          How It Works
        </h2>

        {/* Two-column layout on desktop - centered and narrower */}
        <div className="grid lg:grid-cols-2 lg:gap-4 items-center max-w-3xl mx-auto">
          {/* Video - visible on all breakpoints, constrained size */}
          <div className="relative aspect-[9/16] h-[65vh] max-h-[65vh] w-auto mx-auto lg:mx-0 rounded-2xl overflow-hidden shadow-2xl bg-black">
            <img src="/release-placeholder.svg" alt="Example media placeholder" className="w-full h-full object-cover" />
          </div>

          {/* Stacked cards – desktop only */}
          <div className="hidden lg:flex flex-col h-full space-y-4">
            {steps.map((step, index) => (
              <Card key={index} className="border shadow-sm bg-white flex-1">
                <CardContent className="p-4 h-full flex flex-col items-center text-center">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center mb-3">
                    <span className="text-sm font-bold text-primary-foreground">
                      {index + 1}
                    </span>
                  </div>
                  <h4 className="font-semibold text-lg mb-1">{step.title}</h4>
                  <p className="text-muted-foreground text-sm">{step.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
