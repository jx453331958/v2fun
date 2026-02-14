import { useEffect, useRef, useState, useCallback, type CSSProperties } from 'react'

const THRESHOLD = 60
const MAX_PULL = 120

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>
}

interface UsePullToRefreshReturn {
  pullDistance: number
  isRefreshing: boolean
  pullStyle: CSSProperties
  containerRef: React.RefObject<HTMLDivElement | null>
}

export function usePullToRefresh({ onRefresh }: UsePullToRefreshOptions): UsePullToRefreshReturn {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const startYRef = useRef(0)
  const pullingRef = useRef(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    setPullDistance(THRESHOLD)
    try {
      await onRefresh()
    } finally {
      setIsRefreshing(false)
      setPullDistance(0)
    }
  }, [onRefresh])

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (isRefreshing) return
      if (window.scrollY <= 0) {
        startYRef.current = e.touches[0].clientY
        pullingRef.current = true
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!pullingRef.current || isRefreshing) return
      const dy = e.touches[0].clientY - startYRef.current
      if (dy > 0 && window.scrollY <= 0) {
        e.preventDefault()
        const distance = Math.min(dy * 0.5, MAX_PULL)
        setPullDistance(distance)
      } else {
        pullingRef.current = false
        setPullDistance(0)
      }
    }

    const onTouchEnd = () => {
      if (!pullingRef.current || isRefreshing) return
      pullingRef.current = false
      setPullDistance((d) => {
        if (d >= THRESHOLD) {
          handleRefresh()
          return d
        }
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
  }, [isRefreshing, handleRefresh])

  const pullStyle: CSSProperties = {
    transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
    transition: pullingRef.current ? 'none' : 'transform 0.3s ease',
  }

  return { pullDistance, isRefreshing, pullStyle, containerRef }
}
