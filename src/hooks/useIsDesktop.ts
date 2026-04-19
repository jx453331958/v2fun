import { useEffect, useState } from 'react'

const QUERY = '(min-width: 960px)'

function getMatch(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(QUERY).matches
}

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(getMatch)

  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return isDesktop
}
