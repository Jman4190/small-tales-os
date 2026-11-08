'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import posthog from 'posthog-js'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'
import { analyticsPath, isAllowedAnalyticsEvent, safeAnalyticsProperties } from '@/lib/analytics-privacy'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
    if (!key || !host) return
    const anonymousId = globalThis.crypto.randomUUID()
    posthog.init(key, {
      api_host: host,
      person_profiles: 'never',
      persistence: 'memory',
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      capture_exceptions: false,
      disable_session_recording: true,
      disable_surveys: true,
      disable_external_dependency_loading: true,
      before_send: (event) => {
        if (!event || !isAllowedAnalyticsEvent(event.event)) return null
        // SDK defaults include full URL/referrer and other identifiers. Keep
        // only explicit metrics and fresh anonymous transport metadata.
        return {
          ...event,
          properties: {
            ...safeAnalyticsProperties(event.properties),
            token: key,
            distinct_id: anonymousId,
            $process_person_profile: false,
          },
        }
      },
    })
    setEnabled(true)
  }, [])

  return <PHProvider client={posthog}>{enabled && <PostHogPageView />}{children}</PHProvider>
}

function PostHogPageView() {
  const pathname = usePathname()
  const client = usePostHog()
  useEffect(() => {
    if (pathname) client.capture('$pageview', { pathname: analyticsPath(pathname) })
  }, [pathname, client])
  return null
}
