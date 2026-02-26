import { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { v1, web } from '../api/client'
import type { V2Topic, V2Node } from '../types'
import Header from '../components/Header'
import TopicCard from '../components/TopicCard'
import Loading from '../components/Loading'
import PullToRefreshIndicator from '../components/PullToRefreshIndicator'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { useInfiniteScroll, type InfiniteScrollSnapshot } from '../hooks/useInfiniteScroll'
import { useListCache } from '../hooks/useListCache'
import { sanitizeHtml } from '../utils/sanitize'
import styles from './NodeDetail.module.css'

interface NodeDetailCache {
  snapshot: InfiniteScrollSnapshot<V2Topic>
  node: V2Node | null
}

export default function NodeDetail() {
  const { name } = useParams<{ name: string }>()
  const cacheKey = `/node/${name}`
  const { save, restore } = useListCache<NodeDetailCache>(cacheKey)
  const cached = useRef(restore()).current

  const [node, setNode] = useState<V2Node | null>(cached?.data.node ?? null)

  useEffect(() => {
    if (!name) return
    v1.nodeInfo(name).then(setNode).catch(() => null)
  }, [name])

  // Restore scroll position (useLayoutEffect runs before paint).
  // Always restore when cached (even scrollY=0) to override the detail page's position.
  useLayoutEffect(() => {
    if (cached) {
      window.scrollTo(0, cached.scrollY)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPage = useCallback(async (page: number) => {
    if (!name) return { items: [] as V2Topic[], hasMore: false }
    const res = await web.nodeTopics(name, page)
    if (!res.success) throw new Error('加载失败')
    const items = res.result || []
    // V2EX shows 20 topics per page. If totalPages is unavailable (parsed as 1),
    // fall back to checking if a full page of items was returned.
    const hasMoreByPage = page < (res.totalPages || 1)
    const hasMoreByCount = items.length >= 20
    return {
      items,
      hasMore: res.totalPages > 1 ? hasMoreByPage : hasMoreByCount,
    }
  }, [name])

  const {
    items: topics,
    isLoading,
    isInitialLoading,
    isExhausted,
    error,
    sentinelRef,
    reset,
    retry,
    getSnapshot,
  } = useInfiniteScroll<V2Topic>({
    fetchPage,
    resetKey: name || '',
    getItemKey: (topic) => topic.id,
    initialState: cached?.data.snapshot,
  })

  // Save state on unmount — useLayoutEffect cleanup runs synchronously
  // before the browser dispatches scroll events from DOM changes.
  const nodeRef = useRef(node)
  nodeRef.current = node
  useLayoutEffect(() => {
    return () => { save({ snapshot: getSnapshot(), node: nodeRef.current }) }
  }, [save, getSnapshot])

  const { pullDistance, status, pullStyle } = usePullToRefresh({
    onRefresh: async () => { reset() },
  })

  return (
    <div className={styles.page}>
      <Header title={node?.title || name || '节点'} showBack />

      <PullToRefreshIndicator pullDistance={pullDistance} status={status} />

      <div style={pullStyle}>
        {isInitialLoading && status === 'idle' ? (
          <Loading />
        ) : error && topics.length === 0 ? (
          <div className={styles.empty}>
            <p>{error}</p>
            <button
              onClick={retry}
              style={{
                marginTop: 12,
                padding: '6px 20px',
                background: 'var(--accent)',
                color: 'var(--bg-primary)',
                borderRadius: 'var(--radius-lg)',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}
            >
              重试
            </button>
          </div>
        ) : (
          <>
            {node?.header?.replace(/<[^>]*>/g, '').trim() && (
              <div
                className={styles.nodeHeader}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(node!.header) }}
              />
            )}
            <div className={styles.topicCount}>
              {node?.topics ? `${node.topics} 个主题` : `${topics.length} 个主题`}
            </div>

            {topics.map((topic, i) => (
              <TopicCard key={topic.id} topic={topic} index={i} />
            ))}

            {topics.length === 0 && !isLoading && (
              <div className={styles.empty}>该节点暂无主题</div>
            )}

            {error && topics.length > 0 && (
              <div className={styles.empty}>
                <p>{error}</p>
                <button
                  onClick={retry}
                  style={{
                    marginTop: 12,
                    padding: '6px 20px',
                    background: 'var(--accent)',
                    color: 'var(--bg-primary)',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                >
                  加载更多
                </button>
              </div>
            )}

            {isLoading && !isInitialLoading && (
              <Loading text="加载更多..." />
            )}

            {isExhausted && topics.length > 0 && (
              <div className={styles.empty} style={{ padding: '24px 20px' }}>
                没有更多了
              </div>
            )}

            {!isExhausted && !error && (
              <div ref={sentinelRef} style={{ height: 1 }} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
