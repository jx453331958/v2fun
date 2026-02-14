import { useState, useRef, useCallback, useEffect } from 'react'

interface UseInfiniteScrollOptions<T> {
  /** Fetch a page of items. Return the items for that page. */
  fetchPage: (page: number) => Promise<T[]>
  /** If a page returns fewer than this many items, hasMore becomes false. Default: 1 */
  pageSize?: number
  /** Whether to start loading immediately. Default: true */
  enabled?: boolean
}

interface UseInfiniteScrollReturn<T> {
  items: T[]
  page: number
  hasMore: boolean
  isLoadingMore: boolean
  sentinelRef: React.RefCallback<HTMLDivElement>
  reset: () => void
  /** Load pages 1..n sequentially, used when jumping to a specific floor */
  loadUpToPage: (targetPage: number) => Promise<T[]>
}

export function useInfiniteScroll<T>({
  fetchPage,
  pageSize = 100,
  enabled = true,
}: UseInfiniteScrollOptions<T>): UseInfiniteScrollReturn<T> {
  const [items, setItems] = useState<T[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const loadingRef = useRef(false)
  const hasMoreRef = useRef(true)
  const pageRef = useRef(1)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Keep refs in sync
  hasMoreRef.current = hasMore
  pageRef.current = page

  const loadNextPage = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return
    loadingRef.current = true
    setIsLoadingMore(true)
    try {
      const nextPage = pageRef.current + 1
      const newItems = await fetchPage(nextPage)
      setItems((prev) => [...prev, ...newItems])
      setPage(nextPage)
      if (newItems.length < pageSize) {
        setHasMore(false)
      }
    } finally {
      loadingRef.current = false
      setIsLoadingMore(false)
    }
  }, [fetchPage, pageSize])

  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
      if (!node || !enabled) return
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            loadNextPage()
          }
        },
        { rootMargin: '200px' }
      )
      observerRef.current.observe(node)
    },
    [loadNextPage, enabled]
  )

  // Cleanup observer on unmount
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
    setHasMore(true)
    loadingRef.current = false
  }, [])

  const loadUpToPage = useCallback(
    async (targetPage: number) => {
      let allItems: T[] = []
      for (let p = 1; p <= targetPage; p++) {
        const pageItems = await fetchPage(p)
        allItems = [...allItems, ...pageItems]
        if (pageItems.length < pageSize) {
          setHasMore(false)
          break
        }
      }
      setItems(allItems)
      setPage(targetPage)
      loadingRef.current = false
      return allItems
    },
    [fetchPage, pageSize]
  )

  return {
    items,
    page,
    hasMore,
    isLoadingMore,
    sentinelRef,
    reset,
    loadUpToPage,
  }
}
