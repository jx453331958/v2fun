import { useState, useEffect, useCallback } from 'react'
import { web } from '../api/client'
import type { V2Topic } from '../types'
import TopicCard from '../components/TopicCard'
import { TopicSkeleton } from '../components/Loading'
import Pagination from '../components/Pagination'
import PullToRefreshIndicator from '../components/PullToRefreshIndicator'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import styles from './Home.module.css'

type Tab = 'hot' | 'latest'

// Persist tab selection across remounts (e.g. navigating to topic and back)
let savedTab: Tab = 'latest'

export default function Home() {
  const [tab, setTab] = useState<Tab>(savedTab)
  const [topics, setTopics] = useState<V2Topic[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = useCallback(async (t: Tab, p: number) => {
    setLoading(true)
    setError('')
    try {
      const res = t === 'hot'
        ? await web.hotTopics()
        : await web.latestTopics(p)
      if (res.success) {
        setTopics(res.result || [])
        setTotalPages(res.totalPages || 1)
      } else {
        setTopics([])
        setTotalPages(1)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(tab, page)
  }, [tab, page, fetchData])

  const handleTabChange = (t: Tab) => {
    savedTab = t
    setTab(t)
    setPage(1)
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const { pullDistance, status, pullStyle } = usePullToRefresh({
    onRefresh: () => fetchData(tab, page),
  })

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.logo}>V2Fun</span>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'hot' ? styles.active : ''}`}
            onClick={() => handleTabChange('hot')}
          >
            热门
          </button>
          <button
            className={`${styles.tab} ${tab === 'latest' ? styles.active : ''}`}
            onClick={() => handleTabChange('latest')}
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
            <button className={styles.retryBtn} onClick={() => fetchData(tab, page)}>
              重试
            </button>
          </div>
        ) : (
          <div>
            {topics.map((topic) => (
              <TopicCard key={topic.id} topic={topic} />
            ))}
            {topics.length === 0 && (
              <div className={styles.empty}>暂无主题</div>
            )}
            <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
          </div>
        )}
      </div>
    </div>
  )
}
