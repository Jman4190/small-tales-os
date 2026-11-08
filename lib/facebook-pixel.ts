declare global {
  interface Window {
    fbq: any;
  }
}

export const trackFacebookEvent = (eventName: string, options?: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', eventName, options);
  }
}; 