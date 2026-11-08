// /app/layout.tsx
import { Poppins, Manrope, Pacifico } from "next/font/google"
import Script from "next/script"
import './globals.css'
import type { Metadata } from 'next'
import { Toaster } from "sonner"
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from "@vercel/speed-insights/next";
import { PostHogProvider } from './providers'
import { FacebookPixel } from "@/components/facebook-pixel"
import { ChunkReloader } from "@/components/chunk-reloader"

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
})

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
})

const pacifico = Pacifico({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-pacifico",
  display: "swap",
})

// Metadata configuration with enhanced SEO
export const metadata: Metadata = {
  title: {
    default: 'Storybook Starter - Personalized Children\'s Books',
    template: '%s | Storybook Starter',
  },
  description: 'Create magical personalized storybooks for your child. Upload one photo and watch your little one become the star of their own adventure. Premium hardcover, 30 pages, 100% satisfaction guaranteed.',
  metadataBase: new URL('https://www.example.com'),
  keywords: ['personalized children books', 'custom storybook', 'kids book with photo', 'personalized gift for kids', 'children\'s book'],
  authors: [{ name: 'Storybook Starter' }],
  creator: 'Storybook Starter',
  publisher: 'Storybook Starter',
  icons: {
    icon: [
      { url: '/release-placeholder.svg', type: 'image/svg+xml' },
      { url: '/release-placeholder.svg', sizes: 'any' },
    ],
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://www.example.com',
    siteName: 'Storybook Starter',
    title: 'Storybook Starter - Personalized Children\'s Books',
    description: 'Create magical personalized storybooks for your child. Upload one photo and watch your little one become the star of their own adventure.',
    images: [
      {
        url: '/release-placeholder.svg',
        width: 1200,
        height: 630,
        alt: 'Storybook Starter - Personalized Children\'s Books',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Storybook Starter - Personalized Children\'s Books',
    description: 'Create magical personalized storybooks for your child. Upload one photo and watch your little one become the star of their own adventure.',
    images: ['/release-placeholder.svg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const trackingDisabled = true // Public reference export disables third-party browser tracking.
  return (
    <html lang="en" className={`${poppins.variable} ${manrope.variable} ${pacifico.variable}`}>
      <head>
        {/* Viewport: Removed zoom restrictions for accessibility (Best Practices) */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />

        {/* Preconnect to font origins */}
        {!trackingDisabled && <link rel="preconnect" href="https://fonts.googleapis.com" />}
        {!trackingDisabled && <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />}

        {/* DNS prefetch for third-party resources (Performance) */}
        {!trackingDisabled && <link rel="dns-prefetch" href="https://www.googletagmanager.com" />}
        {!trackingDisabled && <link rel="dns-prefetch" href="https://connect.facebook.net" />}

        {/* Preload LCP image for faster rendering (Performance) */}
        <link
          rel="preload"
          as="image"
          href="/release-placeholder.svg"
          type="image/avif"
        />

        {!trackingDisabled && <FacebookPixel />}
        {!trackingDisabled && <Script
          id="gtag-src"
          src="https://www.googletagmanager.com/gtag/js?id=AW-0"
          strategy="lazyOnload"
        />}
        {!trackingDisabled && <Script
          id="gtag-init"
          strategy="lazyOnload"
        >
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'AW-0');
          `}
        </Script>}
      </head>
      <body className="overflow-x-hidden">
        {/* Skip to main content link for accessibility */}
        <a href="#main-content" className="skip-to-main">
          Skip to main content
        </a>
        <PostHogProvider>
          <ChunkReloader />
          {children}
          <Toaster />
          {!trackingDisabled && <Analytics />}
          {!trackingDisabled && <SpeedInsights />}
        </PostHogProvider>
      </body>
    </html>
  )
}



