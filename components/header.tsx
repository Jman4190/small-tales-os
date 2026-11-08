//
'use client';

import Link from 'next/link'
import Image from 'next/image'
import { Pacifico } from 'next/font/google'
import { Button } from "@/components/ui/button"
import { MobileMenu } from "./mobile-menu"
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

const pacifico = Pacifico({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
})

export function Header() {
  const router = useRouter()
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      
      // Show header if scrolling up, hide if scrolling down
      // Adding a small threshold (e.g., 10px) to prevent tiny scroll fluctuations
      if (currentScrollY < lastScrollY - 10 || currentScrollY < 50) {
        setIsVisible(true)
      } else if (currentScrollY > lastScrollY + 10) {
        setIsVisible(false)
      }
      
      setLastScrollY(currentScrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [lastScrollY])

  // Add effect to check current path
  useEffect(() => {
    const path = window.location.pathname
    if (path === '/') {
      setActiveSection('home')
    } else if (path === '/photo-examples') {
      setActiveSection('examples')
    } else if (path === '/book-sample') {
      setActiveSection('sample')
    }
  }, [])

  const scrollToSection = async (sectionId: string) => {
    if (window.location.pathname !== '/') {
      await router.push('/')
      // Use a more reliable way to wait for navigation and DOM update
      return new Promise((resolve) => {
        const checkSection = setInterval(() => {
          const section = document.getElementById(sectionId)
          if (section) {
            clearInterval(checkSection)
            section.scrollIntoView({ behavior: 'smooth' })
            setActiveSection(sectionId)
            resolve(true)
          }
        }, 50) // Check every 50ms

        // Timeout after 2 seconds
        setTimeout(() => {
          clearInterval(checkSection)
          resolve(false)
        }, 2000)
      })
    } else {
      const section = document.getElementById(sectionId)
      if (section) {
        section.scrollIntoView({ behavior: 'smooth' })
        setActiveSection(sectionId)
      }
    }
  }

  return (
    <header className={`w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50 sticky top-0 border-b transition-transform duration-300 ${
      isVisible ? 'translate-y-0' : '-translate-y-full'
    } md:translate-y-0`}>
      <div className="container mx-auto flex h-16 items-center justify-between px-6">
        <Link href="/" className="flex items-center">
          <Image
            src="/release-placeholder.svg"
            alt="Storybook Starter"
            width={120}
            height={32}
            priority
            className="h-8 w-auto"
          />
        </Link>
        <nav className="hidden md:flex items-center space-x-8 font-sans">
          <Link 
            href="/" 
            className={`text-base hover:text-primary ${activeSection === 'home' ? 'font-bold' : ''}`}
          >
            Home
          </Link>
          <Link 
            href="/book-sample" 
            className={`text-base hover:text-primary ${activeSection === 'sample' ? 'font-bold' : ''}`}
          >
            Sample
          </Link>
          <Link 
            href="/photo-examples" 
            className={`text-base hover:text-primary ${activeSection === 'examples' ? 'font-bold' : ''}`}
          >
            Examples
          </Link>
          <button
            onClick={() => scrollToSection('latest-reviews')}
            className={`text-base hover:text-primary cursor-pointer bg-transparent border-none ${activeSection === 'latest-reviews' ? 'font-bold' : ''}`}
            type="button"
          >
            Reviews
          </button>
          <button
            onClick={() => scrollToSection('faqs')}
            className={`text-base hover:text-primary cursor-pointer bg-transparent border-none ${activeSection === 'faqs' ? 'font-bold' : ''}`}
            type="button"
          >
            FAQs
          </button>
        </nav>
        <div className="hidden md:block">
          <Button variant="outline" className="bg-transparent text-black hover:bg-gray-50" onClick={() => router.push('/create-book')}>Try for Free</Button>
        </div>
        <MobileMenu />
      </div>
    </header>
  )
}
