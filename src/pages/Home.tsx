import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { v1 } from '../api/client'
import type { V2Topic } from '../types'
import TopicCard from '../components/TopicCard'
import { TopicSkeleton } from '../components/Loading'
import styles from './Home.module.css'

type Tab = 'hot' | 'latest'

export default function Home() {
  const [tab, setTab] = useState<Tab>('hot')
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

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <h1 className={styles.logo}>V2Fun</h1>
          <span className={styles.tagline}>创意工作者的社区</span>
        </div>
      </header>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'hot' ? styles.active : ''}`}
          onClick={() => setTab('hot')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2c.5 4-2 7-2 7s3 3 3 7-3 7-3 7" />
            <path d="M8 14c0-3 2-5 2-5s-2 3-2 5 1 4 1 4" />
          </svg>
          热门
        </button>
        <button
          className={`${styles.tab} ${tab === 'latest' ? styles.active : ''}`}
          onClick={() => setTab('latest')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          最新
        </button>
        <div
          className={styles.tabIndicator}
          style={{ transform: `translateX(${tab === 'hot' ? 0 : 100}%)` }}
        />
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <TopicSkeleton />
          </motion.div>
        ) : error ? (
          <motion.div
            key="error"
            className={styles.error}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p>{error}</p>
            <button className={styles.retryBtn} onClick={() => fetchTopics(tab)}>
              重试
            </button>
          </motion.div>
        ) : (
          <motion.div
            key={tab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {topics.map((topic, i) => (
              <TopicCard key={topic.id} topic={topic} index={i} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
