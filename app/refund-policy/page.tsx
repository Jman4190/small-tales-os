import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  alternates: {
    canonical: '/refund-policy',
  },
}

export default function RefundPolicy() {
  return (
    <>
      <Header />
      <main className="container mx-auto px-4 py-12 min-h-screen">
        <div className="prose max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">Refund Policy</h1>
          <p className="text-sm text-muted-foreground mb-6">Last Updated: 2025-03-01</p>
          
          <div className="bg-accent p-6 rounded-lg mb-8">
            <p className="mb-4">At Storybook Starter ("we," "us," or "our"), we strive to ensure that each customer is fully satisfied with our products. Because our books are custom-made for each order, we have specific policies regarding cancellations, returns, and refunds as outlined below.</p>
          </div>
          
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">1. Cancellation Policy</h2>
            <div className="pl-4 border-l-2 border-accent mb-6">
              <h3 className="text-xl font-medium mb-2">Order Cancellation</h3>
              <p className="mb-4">You may cancel your order and receive a full refund if you notify us within 24 hours of placing the order. After 24 hours, your book may already be in production, and we may not be able to cancel or refund your purchase.</p>
            </div>
            
            <div className="pl-4 border-l-2 border-accent mb-6">
              <h3 className="text-xl font-medium mb-2">How to Cancel</h3>
              <p className="mb-4">To cancel your order, please email us at <a href="mailto:contact@example.com" className="underline hover:text-blue-600">contact@example.com</a> with your order details. We will confirm your cancellation by email.</p>
            </div>
          </section>
          
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">2. Returns and Refunds</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-muted p-5 rounded-lg">
                <h3 className="text-xl font-medium mb-3">Customized Products</h3>
                <p>Because each book is personalized, we generally do not accept returns or provide refunds once production has begun.</p>
              </div>
              
              <div className="bg-muted p-5 rounded-lg">
                <h3 className="text-xl font-medium mb-3">Damaged or Defective Items</h3>
                <p>If the book you receive is damaged, defective, or incorrect, please contact us immediately at <a href="mailto:contact@example.com" className="underline hover:text-blue-600">contact@example.com</a>. We may request photos or additional details to evaluate the issue and provide the best solution.</p>
              </div>
            </div>
            
            <div className="pl-4 border-l-2 border-accent mb-6">
              <p className="mb-4">If the claim is valid, we will either provide a free replacement or issue a full refund, depending on your preference.</p>
            </div>
          </section>
          
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">3. Refund Timelines</h2>
            
            <div className="pl-4 border-l-2 border-accent mb-6">
              <h3 className="text-xl font-medium mb-2">Processing Time</h3>
              <p className="mb-4">If a refund is approved, it will be processed within 7–10 business days from our approval date. Depending on your financial institution, additional time may be required for the credit to reflect in your account.</p>
            </div>
            
            <div className="pl-4 border-l-2 border-accent mb-6">
              <h3 className="text-xl font-medium mb-2">Follow-Up</h3>
              <p className="mb-4">If you have not received a confirmed refund after 14 business days from our approval, please reach out to us at <a href="mailto:contact@example.com" className="underline hover:text-blue-600">contact@example.com</a>, and we will assist in tracking your refund status.</p>
            </div>
          </section>
          
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">4. Shipping and Delivery</h2>
            
            <div className="bg-accent p-5 rounded-lg mb-6">
              <h3 className="text-xl font-medium mb-3">Inspection Upon Delivery</h3>
              <p>We encourage you to inspect your order as soon as it arrives. If you notice any damage or issues, contact us right away so we can resolve the problem promptly.</p>
            </div>
          </section>
          
          <section className="mb-10">
            <div className="bg-muted p-6 rounded-lg text-center">
              <h2 className="text-2xl font-semibold mb-4">5. Contact Us</h2>
              <p className="mb-4">If you have any questions or concerns about your order, refund status, or these policies, please contact us at:</p>
              <p className="font-medium">Email: <a href="mailto:contact@example.com" className="underline hover:text-blue-600">contact@example.com</a></p>
            </div>
          </section>
          
          <div className="bg-accent p-5 rounded-lg text-center mb-6">
            <p className="font-medium">We appreciate your understanding and cooperation. Thank you for choosing Storybook Starter for your personalized reading experience.</p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
} 