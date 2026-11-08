import { NextResponse } from 'next/server'

export async function GET() {
  const robotsTxt = `User-agent: *
Allow: /

# Sitemaps
Sitemap: https://www.example.com/api/sitemap.xml
Sitemap: https://www.example.com/api/llm-answers-sitemap.txt

# LLM Manifest
Allow: /llms.txt`

  return new NextResponse(robotsTxt, {
    headers: {
      'Content-Type': 'text/plain',
    },
  })
}
