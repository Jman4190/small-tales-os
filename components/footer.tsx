// /components/footer.tsx
'use client';

import Link from 'next/link'
import { ArrowRight, Instagram } from 'lucide-react'
import { SiTiktok } from 'react-icons/si';
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useRouter } from 'next/navigation'

export function Footer() {
  const router = useRouter()

  const scrollToSection = async (sectionId: string) => {
    if (window.location.pathname !== '/') {
      await router.push('/')
      return new Promise((resolve) => {
        const checkSection = setInterval(() => {
          const section = document.getElementById(sectionId)
          if (section) {
            clearInterval(checkSection)
            section.scrollIntoView({ behavior: 'smooth' })
            resolve(true)
          }
        }, 50)

        setTimeout(() => {
          clearInterval(checkSection)
          resolve(false)
        }, 2000)
      })
    } else {
      const section = document.getElementById(sectionId)
      if (section) {
        section.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }

  return (
    <footer className="bg-muted/50 border-t">
      <div className="container px-4 py-12 mx-auto">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {/* About Us */}
          <div>
            <h3 className="text-lg font-semibold mb-4">About Us</h3>
            <p className="text-sm text-muted-foreground">
              Storybook Starter creates personalized illustration books that capture your child's
              imagination and make them the star of their own adventure.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/photo-examples" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Examples
                </Link>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('latest-reviews')}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer bg-transparent border-none p-0 text-left"
                  type="button"
                >
                  Reviews
                </button>
              </li>
              <li>
                <Link href="/#how-it-works" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('faqs')}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer bg-transparent border-none p-0 text-left"
                  type="button"
                >
                  FAQs
                </button>
              </li>
            </ul>
          </div>

          {/* Learn */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Learn</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/course" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Build Your AI Business Course
                </Link>
              </li>
              {/* Blog link — uncomment once first post is published */}
              {/* <li>
                <Link href="/blog" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Blog
                </Link>
              </li> */}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/privacy" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/refund-policy" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Refund Policy
                </Link>
              </li>
              <li>
                <Link href="/shipping" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Shipping Information
                </Link>
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact Us</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Have questions?
            </p>
            <a 
              href="mailto:support@example.com" 
              className="text-sm text-primary hover:underline transition-colors"
            >
              support@example.com
            </a>
            <div className="mt-4 flex items-center">
              <a
                href="https://example.com/social/instagram"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors mr-3"
                aria-label="Visit Storybook Starter on Instagram"
              >
                <Instagram size={24} />
              </a>
              <a
                href="https://example.com/social/tiktok"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
                aria-label="Visit Storybook Starter on TikTok"
              >
                <SiTiktok size={24} />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t mt-12 pt-8">
          <p className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Storybook Starter, LLC. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}

