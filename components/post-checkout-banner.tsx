'use client'

import { useState, useEffect } from 'react'
import { Clock, CheckCircle2, Printer, Truck } from 'lucide-react'

export function PostCheckoutBanner() {
  const [isVisible, setIsVisible] = useState(false)
  
  useEffect(() => {
    const hasCompletedCheckout = localStorage.getItem('hasCompletedCheckout')
    if (hasCompletedCheckout) {
      setIsVisible(true)
    }
  }, [])

  if (!isVisible) return null

  return (
    <div className="w-full bg-green-50 border-b border-green-100">
      <div className="container mx-auto px-4 py-6">
        <div className="text-center mb-6">
          <h3 className="text-xl font-semibold text-green-800">What Happens Next</h3>
        </div>
        
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="flex items-start space-x-3">
              <div className="shrink-0">
                <Clock className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-800">20 Minutes</p>
                <p className="text-sm text-green-700">You'll receive an email with your PDF Book Preview</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="shrink-0">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-800">Review</p>
                <p className="text-sm text-green-700">Review the images and approve the book</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="shrink-0">
                <Printer className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-800">Printing</p>
                <p className="text-sm text-green-700">Approved books go into production immediately</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="shrink-0">
                <Truck className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-800">Delivery</p>
                <p className="text-sm text-green-700">Books typically arrive 9-12 business days after approval</p>
              </div>
            </div>
          </div>
          
          <div className="text-center text-green-700 text-sm">
            Got questions? {' '}
            <a 
              href="mailto:support@example.com" 
              className="text-green-800 hover:underline"
            >
              support@example.com
            </a>
          </div>
        </div>
      </div>
    </div>
  )
} 