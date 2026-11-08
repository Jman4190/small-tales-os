import Script from 'next/script'

export default function Head() {
  const orgJson = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Storybook Starter',
    url: 'https://www.example.com',
    logo: 'https://www.example.com/release-placeholder.svg',
    sameAs: [
      'https://example.com/social/instagram',
      'https://example.com/social/tiktok',
    ],
  }

  const siteJson = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    url: 'https://www.example.com',
    name: 'Storybook Starter',
  }

  return (
    <>
      <Script
        id="ld-org"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJson) }}
      />
      <Script
        id="ld-website"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJson) }}
      />
    </>
  )
}
