import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import Link from "next/link"

const avatarInitials = ["J", "M", "S", "E", "A", "R"]

export function HeroSection() {
  return (
    <section id="hero-section" className="w-full py-8 md:py-16">
      <div className="container px-4 mx-auto">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-bold tracking-tight leading-[1.2] mb-6">
            See Example
            <span className="block mt-2 text-[#5075FE]">
              Transformations
            </span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground mb-12 font-sans max-w-3xl mx-auto leading-relaxed">
            See how we transform ordinary photos into extraordinary book characters.
          </p>
          <div className="flex items-center justify-center gap-4">
            <div className="flex -space-x-3">
              {avatarInitials.map((initial, i) => (
                <Avatar key={i} className="border-2 border-white w-10 h-10">
                  <AvatarFallback className="bg-gray-200 text-xs font-semibold">
                    {initial}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-yellow-400 text-lg">
                    ★
                  </span>
                ))}
              </div>
              <span className="text-sm font-medium">from 20+ reviews</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
