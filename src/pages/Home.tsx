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
        <span className={styles.logo}>V2Fun</span>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'hot' ? styles.active : ''}`}
            onClick={() => setTab('hot')}
          >
            热门
          </button>
          <button
            className={`${styles.tab} ${tab === 'latest' ? styles.active : ''}`}
            onClick={() => setTab('latest')}
          >
            最新
          </button>
          <div
            className={styles.tabSlider}
            style={{ transform: `translateX(${tab === 'hot' ? 0 : '100%'})` }}
          />
        </div>
      </header>

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
