'use client'

import { useDismissibleBanner } from '@/hooks/use-dismissible-banner'

export function BetaBanner() {
  const { isVisible, dismiss: dismissBanner } = useDismissibleBanner('betaBannerDismissed')

  if (!isVisible) return null

  return (
    <div className="w-full bg-blue-50 border-b border-blue-100">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        {/* Empty div for desktop layout balance */}
        <div className="hidden md:block w-7"></div>
        
        {/* Center content */}
        <div className="flex items-center mx-auto md:mx-0">
          <span className="inline-flex p-1 mr-3 bg-blue-100 rounded-full w-6 h-6 items-center justify-center shrink-0">
            <svg className="w-3 h-3 text-blue-600" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 0C4.486 0 0 4.486 0 10s4.486 10 10 10 10-4.486 10-10S15.514 0 10 0zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z"/>
              <path d="M9 5h2v8H9zm0 10h2v2H9z"/>
            </svg>
            <span className="sr-only">Beta icon</span>
          </span>
          <p className="text-sm font-normal text-blue-800">
            Storybook Starter is currently in closed beta. 
            <a 
              href="mailto:contact@example.com" 
              className="inline ml-1 font-medium text-blue-600 hover:underline"
            >
              Request access via email
            </a>
          </p>
        </div>
        
        {/* Dismiss button */}
        <button 
          onClick={dismissBanner}
          className="shrink-0 inline-flex justify-center w-7 h-7 items-center text-blue-400 hover:bg-blue-100 hover:text-blue-800 rounded-lg text-sm p-1.5"
        >
          <svg className="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
          </svg>
          <span className="sr-only">Close banner</span>
        </button>
      </div>
    </div>
  )
} 