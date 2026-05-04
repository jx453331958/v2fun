import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { web } from '../api/client'
import type { V2Topic } from '../types'
import TopicCard from '../components/TopicCard'
import { TopicSkeleton } from '../components/Loading'
import Pagination from '../components/Pagination'
import PullToRefreshIndicator from '../components/PullToRefreshIndicator'
import TopicDetail from './TopicDetail'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { useListCache } from '../hooks/useListCache'
import { useIsDesktop } from '../hooks/useIsDesktop'
import styles from './Home.module.css'

type Tab = 'hot' | 'latest'

interface HomeCache {
  tab: Tab
  topics: V2Topic[]
  page: number
  totalPages: number
}

export default function Home() {
  const { save, restore } = useListCache<HomeCache>('/')
  const cached = useRef(restore()).current
  const isDesktop = useIsDesktop()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [tab, setTab] = useState<Tab>(cached?.data.tab ?? 'latest')
  const [topics, setTopics] = useState<V2Topic[]>(cached?.data.topics ?? [])
  const [page, setPage] = useState(cached?.data.page ?? 1)
  const [totalPages, setTotalPages] = useState(cached?.data.totalPages ?? 1)
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState('')

  const selectedTopicId = (() => {
    const v = searchParams.get('t')
    if (!v) return null
    const n = parseInt(v)
    return isNaN(n) ? null : n
  })()

  // Refs for unmount save
  const stateRef = useRef({ tab, topics, page, totalPages })
  stateRef.current = { tab, topics, page, totalPages }

  const listColumnRef = useRef<HTMLDivElement>(null)

  // Per-tab scroll memory so switching tabs doesn't carry the old tab's scrollY over.
  // Seed from cached snapshot so the first tab-switch saves the right position.
  const scrollPositionsRef = useRef<Record<Tab, number>>({
    hot: cached?.data.tab === 'hot' ? cached.scrollY : 0,
    latest: cached?.data.tab === 'latest' ? cached.scrollY : 0,
  })
  const pendingScrollTabRef = useRef<Tab | null>(null)
  // Snapshot of `topics` at the moment of tab switch — used to detect when the
  // new tab's data has actually loaded (vs the stale list left over from the previous tab).
  const tabSwitchTopicsRef = useRef<V2Topic[]>(cached?.data.topics ?? [])

  const getScrollTop = useCallback(() => {
    return isDesktop ? listColumnRef.current?.scrollTop ?? 0 : window.scrollY
  }, [isDesktop])

  const scrollToPosition = useCallback((y: number) => {
    if (isDesktop) {
      listColumnRef.current?.scrollTo({ top: y })
    } else {
      window.scrollTo({ top: y })
    }
  }, [isDesktop])

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
        // Keep previous topics/totalPages so the user can retry or go back.
        // Resetting here would hide the pagination and strand the user on a dead page.
        const msg = (res as { message?: string; error?: string }).message
          || (res as { error?: string }).error
          || '加载失败'
        setError(msg)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  // Restore scroll position on mount (useLayoutEffect runs before paint).
  useLayoutEffect(() => {
    if (cached) {
      window.scrollTo(0, cached.scrollY)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch data (skip if restored from a healthy cache; refetch if cache is empty/stale)
  const skipInitialFetch = useRef(!!cached && (cached.data.topics?.length ?? 0) > 0)
  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false
      return
    }
    fetchData(tab, page)
  }, [tab, page, fetchData])

  // Save state on unmount — but never persist an empty/error snapshot.
  // Caching a broken state would restore the dead page on next visit.
  useLayoutEffect(() => {
    return () => {
      if (stateRef.current.topics.length > 0) {
        save(stateRef.current)
      }
    }
  }, [save])

  const handleTabChange = (t: Tab) => {
    if (t === tab) return
    scrollPositionsRef.current[tab] = getScrollTop()
    pendingScrollTabRef.current = t
    tabSwitchTopicsRef.current = topics
    setTab(t)
    setPage(1)
  }

  // Restore the destination tab's scroll once its NEW content has rendered.
  // We can't just wait on `loading` — at the moment of tab switch the previous
  // fetch's `loading` is already false, and the new fetch hasn't started yet.
  // Instead watch for `topics` to flip to a fresh array (set by the new fetch),
  // which guarantees the layout matches the saved scroll position.
  useLayoutEffect(() => {
    if (pendingScrollTabRef.current === tab && topics !== tabSwitchTopicsRef.current) {
      scrollToPosition(scrollPositionsRef.current[tab])
      pendingScrollTabRef.current = null
    }
  }, [tab, topics, scrollToPosition])

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    if (isDesktop && listColumnRef.current) {
      listColumnRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleSelectTopic = useCallback((topicId: number) => {
    if (isDesktop) {
      setSearchParams({ t: String(topicId) }, { replace: false })
    } else {
      navigate(`/topic/${topicId}`)
    }
  }, [isDesktop, navigate, setSearchParams])

  const { pullDistance, status, pullStyle } = usePullToRefresh({
    onRefresh: () => fetchData(tab, page),
  })

  const listSection = (
    <>
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

      {!isDesktop && <PullToRefreshIndicator pullDistance={pullDistance} status={status} />}

      <div style={isDesktop ? undefined : pullStyle}>
        {loading && status === 'idle' && topics.length === 0 ? (
          <TopicSkeleton />
        ) : error && topics.length === 0 ? (
          <div className={styles.error}>
            <p>{error}</p>
            <button className={styles.retryBtn} onClick={() => fetchData(tab, page)}>
              重试
            </button>
          </div>
        ) : (
          <div>
            {error && (
              <div className={styles.error}>
                <p>{error}</p>
                <button className={styles.retryBtn} onClick={() => fetchData(tab, page)}>
                  重试
                </button>
              </div>
            )}
            {topics.map((topic) => (
              <TopicCard
                key={topic.id}
                topic={topic}
                onSelect={isDesktop ? handleSelectTopic : undefined}
                selected={isDesktop && selectedTopicId === topic.id}
              />
            ))}
            {topics.length === 0 && !error && (
              <div className={styles.empty}>暂无主题</div>
            )}
            <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
          </div>
        )}
      </div>
    </>
  )

  if (isDesktop) {
    return (
      <div className={styles.splitPage}>
        <div ref={listColumnRef} className={styles.listColumn}>{listSection}</div>
        <div className={styles.detailColumn}>
          {selectedTopicId ? (
            <TopicDetail key={selectedTopicId} topicId={selectedTopicId} embedded />
          ) : (
            <div className={styles.detailEmpty}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <p>选择左侧话题查看详情</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return <div className={styles.page}>{listSection}</div>
}
