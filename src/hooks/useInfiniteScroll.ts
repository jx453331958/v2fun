import { useRef, useEffect, useCallback, useState } from 'react'

interface UseInfiniteScrollOptions<T> {
  fetchPage: (page: number) => Promise<{ items: T[]; hasMore: boolean }>
  resetKey: string
  rootMargin?: string
  getItemKey?: (item: T) => string | number
}

interface UseInfiniteScrollReturn<T> {
  items: T[]
  isLoading: boolean
  isInitialLoading: boolean
  isExhausted: boolean
  error: string
  sentinelRef: (node: HTMLElement | null) => void
  reset: () => void
  retry: () => void
}

export function useInfiniteScroll<T>({
  fetchPage,
  resetKey,
  rootMargin = '200px',
  getItemKey,
}: UseInfiniteScrollOptions<T>): UseInfiniteScrollReturn<T> {
  const [items, setItems] = useState<T[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isExhausted, setIsExhausted] = useState(false)
  const [error, setError] = useState('')

  // Use refs for mutable state to avoid stale closures in observer
  const pageRef = useRef(1)
  const exhaustedRef = useRef(false)
  const errorRef = useRef('')
  const fetchingRef = useRef(false)
  const generationRef = useRef(0)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const sentinelNodeRef = useRef<HTMLElement | null>(null)
  const prevResetKeyRef = useRef(resetKey)
  const fetchPageRef = useRef(fetchPage)
  const getItemKeyRef = useRef(getItemKey)

  fetchPageRef.current = fetchPage
  getItemKeyRef.current = getItemKey

  const doFetch = useCallback((targetPage: number, isReset: boolean) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setIsLoading(true)
    if (isReset) setIsInitialLoading(true)
    setError('')
    errorRef.current = ''

    const gen = isReset ? ++generationRef.current : generationRef.current

    fetchPageRef.current(targetPage).then(({ items: newItems, hasMore }) => {
      if (gen !== generationRef.current) return

      const getKey = getItemKeyRef.current
      setItems(prev => {
        if (isReset) return newItems
        if (!getKey) return [...prev, ...newItems]
        const existingKeys = new Set(prev.map(getKey))
        return [...prev, ...newItems.filter(item => !existingKeys.has(getKey(item)))]
      })
      exhaustedRef.current = !hasMore
      setIsExhausted(!hasMore)
      pageRef.current = targetPage
      fetchingRef.current = false
      setIsLoading(false)
      setIsInitialLoading(false)
    }).catch(() => {
      if (gen !== generationRef.current) return
      errorRef.current = '网络错误，请重试'
      setError('网络错误，请重试')
      fetchingRef.current = false
      setIsLoading(false)
      setIsInitialLoading(false)
    })
  }, [])

  // Reset when resetKey changes
  useEffect(() => {
    if (resetKey !== prevResetKeyRef.current) {
      prevResetKeyRef.current = resetKey
      setItems([])
      pageRef.current = 1
      exhaustedRef.current = false
      setIsExhausted(false)
      errorRef.current = ''
      setError('')
      fetchingRef.current = false
      doFetch(1, true)
    }
  }, [resetKey, doFetch])

  // Initial fetch
  useEffect(() => {
    doFetch(1, true)
  }, [doFetch])

  // Stable observer callback that reads from refs
  const handleIntersect = useCallback((entries: IntersectionObserverEntry[]) => {
    if (entries[0].isIntersecting && !fetchingRef.current && !exhaustedRef.current && !errorRef.current) {
      doFetch(pageRef.current + 1, false)
    }
  }, [doFetch])

  // Sentinel ref callback — stable dependencies, no page/isExhausted/error
  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      sentinelNodeRef.current = node

      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }

      if (!node) return

      observerRef.current = new IntersectionObserver(handleIntersect, { rootMargin })
      observerRef.current.observe(node)
    },
    [handleIntersect, rootMargin]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [])

  const reset = useCallback(() => {
    setItems([])
    pageRef.current = 1
    exhaustedRef.current = false
    setIsExhausted(false)
    errorRef.current = ''
    setError('')
    fetchingRef.current = false
    doFetch(1, true)
  }, [doFetch])

  const retry = useCallback(() => {
    errorRef.current = ''
    setError('')
    doFetch(pageRef.current + 1, false)
  }, [doFetch])

  return {
    items,
    isLoading,
    isInitialLoading,
    isExhausted,
    error,
    sentinelRef,
    reset,
    retry,
  }
}
