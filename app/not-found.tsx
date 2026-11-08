"use client"

import { useState, useEffect } from "react"
import { Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SparklesText } from "@/components/ui/sparkles-text"
import Link from "next/link"
import { motion } from "framer-motion"
import { Header } from "@/components/header"

// Story-related emojis
const storyEmojis = ["📚", "🧙‍♂️", "🦄", "🐉", "🏰", "🌈", "🔮", "⭐", "🧸", "🦊", "🌟", "🧩"]

export default function NotFound() {
  const [emojis, setEmojis] = useState<string[]>([])
  const [windowWidth, setWindowWidth] = useState(0)
  const isMobile = windowWidth > 0 && windowWidth < 640

  useEffect(() => {
    // Set window width
    setWindowWidth(window.innerWidth)
    
    // Add resize listener
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    
    // Create a random selection of emojis
    const randomEmojis = []
    const usedIndices = new Set()

    while (randomEmojis.length < 6) {
      const index = Math.floor(Math.random() * storyEmojis.length)
      if (!usedIndices.has(index)) {
        usedIndices.add(index)
        randomEmojis.push(storyEmojis[index])
      }
    }

    setEmojis(randomEmojis)
    
    // Cleanup
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col">
      {/* Gradient background integrated with #5075FE */}
      <div className="fixed inset-0 -z-10 h-full w-full bg-gradient-to-b from-blue-50 via-indigo-50 to-blue-100" style={{
        background: "linear-gradient(to bottom, #EEF2FF, #E0E7FF, #DBE4FE)"
      }} />

      {/* Header */}
      <Header />

      {/* Lost page content */}
      <div className="container max-w-3xl mx-auto flex-1 flex flex-col justify-center px-4 text-center -mt-8 sm:mt-0 py-8">
        <div className="mb-10 sm:mb-14 md:mb-16">
          <SparklesText
            text="Oops! Page Not Found"
            colors={{ first: "#5075FE", second: "#8B5CF6" }}
            className="text-center tracking-tight text-3xl sm:text-4xl md:text-5xl font-bold"
          />

          <h2 className="mt-4 sm:mt-6 text-base sm:text-xl md:text-2xl font-medium text-gray-700">
            This page seems to have wandered off into another book
          </h2>
        </div>

        {/* Animated book with page turning effect - without rotation */}
        <div className="relative h-[200px] sm:h-[250px] md:h-[300px] mb-10 sm:mb-14 md:mb-16 flex items-center justify-center">
          <div className="relative w-48 h-60 sm:w-56 sm:h-72 md:w-64 md:h-80">
            <div className="w-full h-full bg-white rounded-r-lg shadow-2xl border-l-8 border-[#5075FE] flex flex-col items-center justify-center p-4 sm:p-6">
              <div className="text-4xl sm:text-5xl md:text-6xl mb-4 sm:mb-6">📖</div>
              <div className="text-2xl sm:text-3xl font-bold text-[#5075FE]">404</div>
              <div className="mt-3 sm:mt-5 text-xs sm:text-sm text-gray-600">Page missing from this story</div>

              {/* Animated page corner */}
              <motion.div
                className="absolute top-0 right-0 w-0 h-0 border-t-[30px] sm:border-t-[40px] border-r-[30px] sm:border-r-[40px] border-t-transparent border-r-[#5075FE]/20"
                animate={{
                  rotate: [0, 5, 0],
                  scale: [1, 1.05, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Number.POSITIVE_INFINITY,
                  repeatType: "reverse",
                }}
              />
            </div>
          </div>

          {/* Floating emojis - fewer on mobile */}
          {windowWidth > 0 && emojis.slice(0, isMobile ? 3 : 6).map((emoji, index) => (
            <motion.div
              key={index}
              initial={{
                x: Math.random() * (isMobile ? 150 : 300) - (isMobile ? 75 : 150),
                y: Math.random() * (isMobile ? 150 : 300) - (isMobile ? 75 : 150),
                opacity: 0,
                scale: 0,
              }}
              animate={{
                opacity: [0, 1, 1, 0],
                scale: [0, 1, 1, 0],
                y: [null, Math.random() * (isMobile ? -50 : -100) - (isMobile ? 25 : 50)],
              }}
              transition={{
                duration: 4 + index,
                repeat: Number.POSITIVE_INFINITY,
                delay: index * 2,
                repeatDelay: 1,
              }}
              className="absolute text-2xl sm:text-3xl md:text-4xl pointer-events-none"
            >
              {emoji}
            </motion.div>
          ))}
        </div>

        {/* Navigation options */}
        <div className="space-y-4 sm:space-y-6">
          <p className="text-sm sm:text-base text-muted-foreground">Let's turn to a page that exists</p>

          <div className="flex justify-center mt-4 sm:mt-6">
            <Link href="/">
              <Button className="px-6 sm:px-8 py-2.5 sm:py-3 text-sm sm:text-base bg-[#5075FE] hover:bg-[#3A5FE8]">
                <Home className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                Return Home
              </Button>
            </Link>
          </div>
        </div>

        {/* Animated book page turning at bottom */}
        <div className="mt-10 sm:mt-16 h-8 sm:h-12 relative overflow-hidden">
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{
              duration: 8,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
            className="absolute bottom-0 h-[1px] w-full bg-gradient-to-r from-transparent via-[#5075FE] to-transparent"
          />
        </div>
      </div>
    </div>
  )
} 