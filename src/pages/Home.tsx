import { useState, useEffect, useCallback } from 'react'
import { v1 } from '../api/client'
import type { V2Topic } from '../types'
import TopicCard from '../components/TopicCard'
import { TopicSkeleton } from '../components/Loading'
import PullToRefreshIndicator from '../components/PullToRefreshIndicator'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import styles from './Home.module.css'

type Tab = 'hot' | 'latest'

// Persist tab selection across remounts (e.g. navigating to topic and back)
let savedTab: Tab = 'latest'

export default function Home() {
  const [tab, setTab] = useState<Tab>(savedTab)
  const [topics, setTopics] = useState<V2Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchTopics = useCallback(async (t: Tab) => {
    setLoading(true)
    setError('')
    try {
      const data = t === 'hot' ? await v1.hotTopics() : await v1.latestTopics()
      setTopics(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTopics(tab)
  }, [tab, fetchTopics])

  const { pullDistance, status, pullStyle } = usePullToRefresh({
    onRefresh: async () => {
      await fetchTopics(tab)
    },
  })

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
            <button className={styles.retryBtn} onClick={() => fetchTopics(tab)}>
              重试
            </button>
          </div>
        ) : (
          <div>
            {topics.map((topic) => (
              <TopicCard key={topic.id} topic={topic} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
