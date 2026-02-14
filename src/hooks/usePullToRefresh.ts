import { useEffect, useRef, useState, useCallback, type CSSProperties } from 'react'

const THRESHOLD = 60
const MAX_PULL = 120
const DONE_DISPLAY_MS = 1200

export type PullStatus = 'idle' | 'pulling' | 'ready' | 'refreshing' | 'success' | 'error'

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>
}

interface UsePullToRefreshReturn {
  pullDistance: number
  status: PullStatus
  pullStyle: CSSProperties
}

// Rubber-band damping: progressive resistance as you pull further
function dampen(dy: number): number {
  // Exponential decay gives a natural "elastic" feel
  return MAX_PULL * (1 - Math.exp(-dy / (MAX_PULL * 1.2)))
}

export function usePullToRefresh({ onRefresh }: UsePullToRefreshOptions): UsePullToRefreshReturn {
  const [pullDistance, setPullDistance] = useState(0)
  const [status, setStatus] = useState<PullStatus>('idle')
  const startYRef = useRef(0)
  const startXRef = useRef(0)
  const pullingRef = useRef(false)
  const lockedRef = useRef(false) // true = confirmed vertical pull; false = undecided or horizontal
  const doneTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const handleRefresh = useCallback(async () => {
    setStatus('refreshing')
    setPullDistance(THRESHOLD)
    try {
      await onRefresh()
      setStatus('success')
    } catch {
      setStatus('error')
    }
    // Hold the done state briefly, then reset
    doneTimerRef.current = setTimeout(() => {
      setStatus('idle')
      setPullDistance(0)
    }, DONE_DISPLAY_MS)
  }, [onRefresh])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const isActive = status === 'refreshing' || status === 'success' || status === 'error'

    const onTouchStart = (e: TouchEvent) => {
      if (isActive) return
      if (window.scrollY <= 0) {
        startYRef.current = e.touches[0].clientY
        startXRef.current = e.touches[0].clientX
        pullingRef.current = true
        lockedRef.current = false
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!pullingRef.current || isActive) return
      const dy = e.touches[0].clientY - startYRef.current
      const dx = e.touches[0].clientX - startXRef.current

      // Determine direction lock on first significant movement
      if (!lockedRef.current) {
        const absDy = Math.abs(dy)
        const absDx = Math.abs(dx)
        // Need at least 10px to decide direction
        if (absDy < 10 && absDx < 10) return
        if (absDx > absDy) {
          // Horizontal swipe — abort pull-to-refresh entirely
          pullingRef.current = false
          return
        }
        if (dy <= 0) {
          // Scrolling up — not a pull
          pullingRef.current = false
          return
        }
        // Confirmed downward vertical pull
        lockedRef.current = true
      }

      if (dy > 0 && window.scrollY <= 0) {
        e.preventDefault()
        const distance = dampen(dy)
        setPullDistance(distance)
        setStatus(distance >= THRESHOLD ? 'ready' : 'pulling')
      } else if (dy <= 0) {
        pullingRef.current = false
        lockedRef.current = false
        setPullDistance(0)
        setStatus('idle')
      }
    }

    const onTouchEnd = () => {
      if (!pullingRef.current || isActive) return
      pullingRef.current = false
      lockedRef.current = false
      setPullDistance((d) => {
        if (d >= THRESHOLD) {
          handleRefresh()
          return d
        }
        setStatus('idle')
        return 0
      })
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [status, handleRefresh])

  const pulling = pullingRef.current && lockedRef.current

  const pullStyle: CSSProperties = {
    transform: `translateY(${pullDistance}px)`,
    transition: pulling ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0, 0, 1)',
    willChange: pulling ? 'transform' : undefined,
  }

  return { pullDistance, status, pullStyle }
}
