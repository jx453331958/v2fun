import { useState, useEffect, useCallback } from 'react'
import { web } from '../api/client'
import type { V2Topic } from '../types'
import TopicCard from '../components/TopicCard'
import { TopicSkeleton } from '../components/Loading'
import Loading from '../components/Loading'
import PullToRefreshIndicator from '../components/PullToRefreshIndicator'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { useInfiniteScroll } from '../hooks/useInfiniteScroll'
import styles from './Home.module.css'

type Tab = 'hot' | 'latest'

// Persist tab selection across remounts (e.g. navigating to topic and back)
let savedTab: Tab = 'latest'

export default function Home() {
  const [tab, setTab] = useState<Tab>(savedTab)
  const [firstPageTopics, setFirstPageTopics] = useState<V2Topic[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchPage = useCallback(
    async (page: number) => {
      if (tab !== 'latest') return []
      try {
        const res = await web.latestTopics(page)
        if (res.success) return res.result || []
      } catch {
        // pagination failed
      }
      return []
    },
    [tab]
  )

  const { items: moreTopics, hasMore, isLoadingMore, sentinelRef, reset } =
    useInfiniteScroll<V2Topic>({
      fetchPage,
      pageSize: 20,
      enabled: !loading && tab === 'latest' && totalPages > 1,
      totalPages,
    })

  const fetchFirstPage = useCallback(async (t: Tab) => {
    reset()
    setLoading(true)
    setError('')
    try {
      const res = t === 'hot'
        ? await web.hotTopics()
        : await web.latestTopics(1)
      if (res.success) {
        setFirstPageTopics(res.result || [])
        setTotalPages(res.totalPages || 1)
      } else {
        setFirstPageTopics([])
        setTotalPages(1)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [reset])

  useEffect(() => {
    fetchFirstPage(tab)
  }, [tab, fetchFirstPage])

  const { pullDistance, status, pullStyle } = usePullToRefresh({
    onRefresh: async () => {
      await fetchFirstPage(tab)
    },
  })

  const allTopics = tab === 'latest'
    ? [...firstPageTopics, ...moreTopics]
    : firstPageTopics

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.logo}>V2Fun</span>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'hot' ? styles.active : ''}`}
            onClick={() => { savedTab = 'hot'; setTab('hot') }}
          >
            热门
          </button>
          <button
            className={`${styles.tab} ${tab === 'latest' ? styles.active : ''}`}
            onClick={() => { savedTab = 'latest'; setTab('latest') }}
          >
            最新
          </button>
          <div
            className={styles.tabSlider}
            style={{ transform: `translateX(${tab === 'latest' ? '100%' : 0})` }}
          />
        </div>
      </header>

      <PullToRefreshIndicator pullDistance={pullDistance} status={status} />

      <div style={pullStyle}>
        {loading && status === 'idle' ? (
          <TopicSkeleton />
        ) : error ? (
          <div className={styles.error}>
            <p>{error}</p>
            <button className={styles.retryBtn} onClick={() => fetchFirstPage(tab)}>
              重试
            </button>
          </div>
        ) : (
          <div>
            {allTopics.map((topic) => (
              <TopicCard key={topic.id} topic={topic} />
            ))}
            {tab === 'latest' && (
              <>
                <div ref={sentinelRef} />
                {isLoadingMore && <Loading text="加载更多..." />}
                {!hasMore && allTopics.length > 0 && (
                  <div className={styles.noMore}>没有更多了</div>
                )}
              </>
            )}
            {allTopics.length === 0 && (
              <div className={styles.empty}>暂无主题</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
