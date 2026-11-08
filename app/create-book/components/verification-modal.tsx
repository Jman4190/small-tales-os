"use client"

import Image from "next/image"
import { useState } from "react"

interface VerificationModalProps {
  open: boolean
}

export function VerificationModal({ open }: VerificationModalProps) {
  const [isImageLoaded, setIsImageLoaded] = useState(false)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <Image
          src="/release-placeholder.svg"
          alt="Background illustration"
          fill
          priority
          quality={90}
          sizes="100vw"
          className={`object-cover transition-opacity duration-300 ${
            isImageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoadingComplete={() => setIsImageLoaded(true)}
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/30" />
      </div>

      {/* Content */}
      {isImageLoaded && (
        <div className="relative z-10 text-center text-white space-y-4 animate-fade-in">
          <h2 className="text-3xl font-serif">Taking a look.</h2>
          <p className="text-xl font-serif italic">
            We&apos;re making sure this photo will work.<br />
            Hang tight!
          </p>
          <div className="mt-8">
            <div className="h-1 w-48 mx-auto bg-white/20 rounded-full overflow-hidden">
              <div className="h-full w-1/2 bg-white rounded-full animate-[progress_1.5s_ease-in-out_infinite]" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}