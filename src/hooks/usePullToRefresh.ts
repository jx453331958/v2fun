import { useEffect, useRef, useState, useCallback, type CSSProperties } from 'react'

const THRESHOLD = 60
const MAX_PULL = 130
const DONE_DISPLAY_MS = 600

export type PullStatus = 'idle' | 'pulling' | 'ready' | 'refreshing' | 'success' | 'error'

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>
}

interface UsePullToRefreshReturn {
  pullDistance: number
  status: PullStatus
  pullStyle: CSSProperties
}

// iOS-style reciprocal damping: starts ~1:1, smooth progressive resistance
// Unlike exponential decay (sharp falloff), this curve decelerates evenly
function dampen(dy: number): number {
  return MAX_PULL * dy / (dy + MAX_PULL)
}

export function usePullToRefresh({ onRefresh }: UsePullToRefreshOptions): UsePullToRefreshReturn {
  const [pullDistance, setPullDistance] = useState(0)
  const [status, setStatus] = useState<PullStatus>('idle')
  const startYRef = useRef(0)
  const startXRef = useRef(0)
  const pullingRef = useRef(false)
  const lockedRef = useRef(false)
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
    doneTimerRef.current = setTimeout(() => {
      setStatus('idle')
      setPullDistance(0)
    }, DONE_DISPLAY_MS)
  }, [onRefresh])

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

      if (!lockedRef.current) {
        const absDy = Math.abs(dy)
        const absDx = Math.abs(dx)
        if (absDy < 10 && absDx < 10) return
        if (absDx > absDy) {
          pullingRef.current = false
          return
        }
        if (dy <= 0) {
          pullingRef.current = false
          return
        }
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

  const pullStyle: CSSProperties = pullDistance > 0
    ? {
        transform: `translateY(${pullDistance}px)`,
        transition: pulling ? 'none' : 'transform 0.4s cubic-bezier(0.33, 1, 0.68, 1)',
        willChange: pulling ? 'transform' : undefined,
      }
    : {}

  return { pullDistance, status, pullStyle }
}
