import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

jest.mock('next/font/google', () => ({
  Poppins: () => ({ variable: 'font-poppins' }),
  Manrope: () => ({ variable: 'font-manrope' }),
  Pacifico: () => ({ variable: 'font-pacifico' }),
}));
jest.mock('@/app/globals.css', () => ({}));
jest.mock('next/script', () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => require('react').createElement('script', props, children),
}));
jest.mock('sonner', () => ({ Toaster: () => null }));
jest.mock('@/app/providers', () => ({ PostHogProvider: ({ children }: any) => children }));
jest.mock('@/components/chunk-reloader', () => ({ ChunkReloader: () => null }));
jest.mock('@vercel/analytics/next', () => ({ Analytics: () => require('react').createElement('script', { src: 'https://vercel-analytics.invalid/collector' }) }));
jest.mock('@vercel/speed-insights/next', () => ({ SpeedInsights: () => require('react').createElement('script', { src: 'https://vercel-performance.invalid/collector' }) }));

import RootLayout from '@/app/layout';

describe('isolated browser advertising and analytics', () => {
  const previous = process.env.ISOLATED_TEST_PROVIDERS;
  afterAll(() => {
    if (previous === undefined) delete process.env.ISOLATED_TEST_PROVIDERS;
    else process.env.ISOLATED_TEST_PROVIDERS = previous;
  });

  it('does not render browser collectors or third-party prefetch hints in the isolated harness', () => {
    process.env.ISOLATED_TEST_PROVIDERS = '1';
    const html = renderToStaticMarkup(<RootLayout><main>Synthetic fixture</main></RootLayout>);
    expect(html).toContain('Synthetic fixture');
    for (const marker of ['facebook.net', 'facebook.com/tr', 'fbq(', 'googletagmanager.com', "gtag('config'", 'vercel-analytics.invalid', 'vercel-performance.invalid', 'fonts.googleapis.com', 'fonts.gstatic.com']) {
      expect(html).not.toContain(marker);
    }
  });

});
