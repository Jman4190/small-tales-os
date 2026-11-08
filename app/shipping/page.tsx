import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import type { Metadata } from 'next'
import Script from 'next/script'

export const metadata: Metadata = {
  alternates: {
    canonical: '/shipping',
  },
}

export default function ShippingInformation() {
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://www.example.com/',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Shipping',
        item: 'https://www.example.com/shipping',
      },
    ],
  }
  return (
    <>
      <Script
        id="ld-breadcrumb"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Header />
      <main className="container mx-auto px-4 py-12 min-h-screen">
        <div className="prose max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">Shipping Information</h1>
          <p className="text-sm text-muted-foreground mb-6">Last Updated: 2025-03-01</p>
          
          <div className="bg-accent p-6 rounded-lg mb-8">
            <p className="mb-4">At Storybook Starter, we aim to deliver your custom storybook as soon as possible while ensuring high-quality printing and packaging. Please review the details below regarding our shipping process and estimated timelines.</p>
          </div>
          
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">1. Estimated Delivery Time</h2>
            <div className="pl-4 border-l-2 border-accent mb-6">
              <h3 className="text-xl font-medium mb-2">Production & Shipping</h3>
              <p className="mb-4">Our standard delivery estimate is 7–10 business days. This timeframe includes:</p>
              <ul className="space-y-2 mb-4">
                <li className="bg-muted p-3 rounded">
                  <p><strong>Order Processing:</strong> Reviewing your order details and preparing artwork.</p>
                </li>
                <li className="bg-muted p-3 rounded">
                  <p><strong>Production:</strong> Printing, binding, and packaging your custom book.</p>
                </li>
                <li className="bg-muted p-3 rounded">
                  <p><strong>Shipping:</strong> Transit from our facility to your delivery address.</p>
                </li>
              </ul>
            </div>
            
            <div className="bg-accent p-5 rounded-lg mb-6">
              <h3 className="text-xl font-medium mb-3">Important Note</h3>
              <p>The production timeline starts after you approve the final PDF proof, not when your order is initially placed. Any delays in PDF approval will affect your estimated delivery date.</p>
            </div>
          </section>
          
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">2. Shipping and Tracking</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-muted p-5 rounded-lg">
                <h3 className="text-xl font-medium mb-3">Order Confirmation</h3>
                <p>Once you place an order, we will email you a confirmation along with any instructions or next steps (e.g., reviewing and approving the PDF proof).</p>
              </div>
              
              <div className="bg-muted p-5 rounded-lg">
                <h3 className="text-xl font-medium mb-3">Tracking Number</h3>
                <p>We will provide you with a tracking number as soon as it's created, allowing you to monitor your shipment's progress.</p>
              </div>
              
              <div className="bg-muted p-5 rounded-lg">
                <h3 className="text-xl font-medium mb-3">Delivery Carrier</h3>
                <p>We work with reputable shipping carriers to ensure your order arrives safely. Carrier availability may vary depending on your location.</p>
              </div>
            </div>
          </section>
          
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">3. Variations in Delivery Times</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-muted p-5 rounded-lg">
                <h3 className="text-xl font-medium mb-3">Not Guaranteed</h3>
                <p>While we strive to meet the 7–10 business day estimate, unforeseen circumstances (such as inclement weather, carrier delays, or production issues) may cause delays.</p>
              </div>
              
              <div className="bg-muted p-5 rounded-lg">
                <h3 className="text-xl font-medium mb-3">Peak Seasons</h3>
                <p>During holidays or peak ordering periods, production and transit times may be longer. We recommend placing orders well in advance of any important date or occasion.</p>
              </div>
            </div>
          </section>
          
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">4. Shipping Address Accuracy</h2>
            
            <div className="pl-4 border-l-2 border-accent mb-6">
              <h3 className="text-xl font-medium mb-2">Correct Information</h3>
              <p className="mb-4">Please ensure the shipping address you provide during checkout is accurate and complete.</p>
            </div>
            
            <div className="pl-4 border-l-2 border-accent mb-6">
              <h3 className="text-xl font-medium mb-2">Address Changes</h3>
              <p className="mb-4">If you need to change your shipping address after placing an order, please contact us immediately at <a href="mailto:contact@example.com" className="underline hover:text-blue-600">contact@example.com</a>. Changes may result in additional processing time.</p>
            </div>
          </section>
          
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">5. Damaged or Delayed Shipments</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-muted p-5 rounded-lg">
                <h3 className="text-xl font-medium mb-3">Damaged Items</h3>
                <p>Upon receiving your package, please inspect the book carefully. If it arrives damaged, promptly contact us at <a href="mailto:contact@example.com" className="underline hover:text-blue-600">contact@example.com</a> with photos and details. We will work to resolve the issue as quickly as possible.</p>
              </div>
              
              <div className="bg-muted p-5 rounded-lg">
                <h3 className="text-xl font-medium mb-3">Transit Delays</h3>
                <p>If your tracking information shows an unexpected delay or if your package is overdue, contact us so we can help investigate the issue with the carrier.</p>
              </div>
            </div>
          </section>
          
          <section className="mb-10">
            <div className="bg-muted p-6 rounded-lg text-center">
              <h2 className="text-2xl font-semibold mb-4">6. Contact Us</h2>
              <p className="mb-4">If you have any questions or concerns about shipping, estimated delivery times, or the status of your order, please reach out to us:</p>
              <p className="font-medium">Email: <a href="mailto:contact@example.com" className="underline hover:text-blue-600">contact@example.com</a></p>
            </div>
          </section>
          
          <div className="bg-accent p-5 rounded-lg text-center mb-6">
            <p className="font-medium">We appreciate your patience and support in creating a one-of-a-kind custom book for you. Thank you for choosing Storybook Starter!</p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
} 