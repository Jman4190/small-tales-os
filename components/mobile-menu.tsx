// /components/mobile-menu.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'

export function MobileMenu() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<string | null>(null)

  const toggleMenu = () => setIsOpen(!isOpen)

  const scrollToSection = async (sectionId: string) => {
    setIsOpen(false)
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
    <div className="md:hidden">
      <button
        onClick={toggleMenu}
        className="p-2"
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={isOpen}
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed left-0 right-0 top-[57px] bg-white border-b shadow-lg z-40"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <nav className="flex flex-col py-2">
              <Link 
                href="/" 
                className="px-6 py-3 text-base hover:bg-gray-100"
                onClick={() => setIsOpen(false)}
              >
                Home
              </Link>
              <Link 
                href="/photo-examples" 
                className="px-6 py-3 text-base hover:bg-gray-100"
                onClick={() => setIsOpen(false)}
              >
                Examples
              </Link>
              <button
                onClick={() => scrollToSection('latest-reviews')}
                className={`px-6 py-3 text-base hover:bg-gray-100 cursor-pointer text-left ${activeSection === 'latest-reviews' ? 'font-bold' : ''}`}
                type="button"
              >
                Reviews
              </button>
              <Link 
                href="/book-sample" 
                className="px-6 py-3 text-base hover:bg-gray-100"
                onClick={() => setIsOpen(false)}
              >
                Sample
              </Link>
              <button
                onClick={() => scrollToSection('faqs')}
                className={`px-6 py-3 text-base hover:bg-gray-100 cursor-pointer text-left ${activeSection === 'faqs' ? 'font-bold' : ''}`}
                type="button"
              >
                FAQs
              </button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

