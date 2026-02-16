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
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isExhausted, setIsExhausted] = useState(false)
  const [error, setError] = useState('')

  const prevResetKeyRef = useRef(resetKey)
  const fetchingRef = useRef(false)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const generationRef = useRef(0)

  const doFetch = useCallback(async (targetPage: number, isReset: boolean) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setIsLoading(true)
    if (isReset) setIsInitialLoading(true)
    setError('')

    const gen = isReset ? ++generationRef.current : generationRef.current

    try {
      const { items: newItems, hasMore } = await fetchPage(targetPage)
      if (gen !== generationRef.current) return

      setItems(prev => {
        if (isReset) return newItems
        if (!getItemKey) return [...prev, ...newItems]
        const existingKeys = new Set(prev.map(getItemKey))
        return [...prev, ...newItems.filter(item => !existingKeys.has(getItemKey(item)))]
      })
      setIsExhausted(!hasMore)
      setPage(targetPage)
    } catch {
      if (gen !== generationRef.current) return
      setError('网络错误，请重试')
    } finally {
      if (gen === generationRef.current) {
        fetchingRef.current = false
        setIsLoading(false)
        setIsInitialLoading(false)
      }
    }
  }, [fetchPage, getItemKey])

  // Reset when resetKey changes
  useEffect(() => {
    if (resetKey !== prevResetKeyRef.current) {
      prevResetKeyRef.current = resetKey
      setItems([])
      setPage(1)
      setIsExhausted(false)
      setError('')
      fetchingRef.current = false
      doFetch(1, true)
    }
  }, [resetKey, doFetch])

  // Initial fetch
  useEffect(() => {
    doFetch(1, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // IntersectionObserver via ref callback
  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }

      if (!node) return

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && !fetchingRef.current && !isExhausted && !error) {
            doFetch(page + 1, false)
          }
        },
        { rootMargin }
      )
      observerRef.current.observe(node)
    },
    [doFetch, page, isExhausted, error, rootMargin]
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
    setPage(1)
    setIsExhausted(false)
    setError('')
    fetchingRef.current = false
    doFetch(1, true)
  }, [doFetch])

  const retry = useCallback(() => {
    setError('')
    const targetPage = items.length === 0 ? 1 : page + 1
    doFetch(targetPage, items.length === 0)
  }, [doFetch, items.length, page])

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
