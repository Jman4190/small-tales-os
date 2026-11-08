'use client'

import { useState, useEffect } from 'react'

export function useDismissibleBanner(storageKey: string) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const dismissed = localStorage.getItem(storageKey)
    if (dismissed) {
      setIsVisible(false)
    }
  }, [storageKey])

  const dismiss = () => {
    setIsVisible(false)
    localStorage.setItem(storageKey, 'true')
  }

  return { isVisible, dismiss }
}
