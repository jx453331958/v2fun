import { createContext, useContext, useCallback, useRef, type ReactNode } from 'react'

interface CacheEntry {
  data: unknown
  scrollY: number
  timestamp: number
}

const TTL = 5 * 60 * 1000 // 5 minutes

interface ListCacheContextValue {
  save: (key: string, data: unknown) => void
  restore: (key: string) => { data: unknown; scrollY: number } | null
}

const ListCacheContext = createContext<ListCacheContextValue | null>(null)

export function ListCacheProvider({ children }: { children: ReactNode }) {
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map())

  const save = useCallback((key: string, data: unknown) => {
    cacheRef.current.set(key, {
      data,
      scrollY: window.scrollY,
      timestamp: Date.now(),
    })
  }, [])

  const restore = useCallback((key: string) => {
    const entry = cacheRef.current.get(key)
    if (!entry) return null
    if (Date.now() - entry.timestamp > TTL) {
      cacheRef.current.delete(key)
      return null
    }
    return { data: entry.data, scrollY: entry.scrollY }
  }, [])

  return (
    <ListCacheContext.Provider value={{ save, restore }}>
      {children}
    </ListCacheContext.Provider>
  )
}

export function useListCache<T>(key: string) {
  const ctx = useContext(ListCacheContext)
  if (!ctx) throw new Error('useListCache must be used within ListCacheProvider')

  const save = useCallback((data: T) => {
    ctx.save(key, data)
  }, [ctx, key])

  const restore = useCallback((): { data: T; scrollY: number } | null => {
    const result = ctx.restore(key)
    if (!result) return null
    return result as { data: T; scrollY: number }
  }, [ctx, key])

  return { save, restore }
}
