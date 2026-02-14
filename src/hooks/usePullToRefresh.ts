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

export function usePullToRefresh({ onRefresh }: UsePullToRefreshOptions): UsePullToRefreshReturn {
  const [pullDistance, setPullDistance] = useState(0)
  const [status, setStatus] = useState<PullStatus>('idle')
  const startYRef = useRef(0)
  const pullingRef = useRef(false)
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
        pullingRef.current = true
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!pullingRef.current || isActive) return
      const dy = e.touches[0].clientY - startYRef.current
      if (dy > 10 && window.scrollY <= 0) {
        // Only preventDefault after a clear downward drag (>10px),
        // so small touch movements during a tap still generate click events
        e.preventDefault()
        const distance = Math.min(dy * 0.5, MAX_PULL)
        setPullDistance(distance)
        setStatus(distance >= THRESHOLD ? 'ready' : 'pulling')
      } else if (dy <= 0) {
        pullingRef.current = false
        setPullDistance(0)
        setStatus('idle')
      }
    }

    const onTouchEnd = () => {
      if (!pullingRef.current || isActive) return
      pullingRef.current = false
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

  const pullStyle: CSSProperties = {
    transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
    transition: pullingRef.current ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0, 0, 1)',
  }

  return { pullDistance, status, pullStyle }
}
