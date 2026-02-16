import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { v1, web } from '../api/client'
import type { V2Topic, V2Node } from '../types'
import Header from '../components/Header'
import TopicCard from '../components/TopicCard'
import Loading from '../components/Loading'
import PullToRefreshIndicator from '../components/PullToRefreshIndicator'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { useInfiniteScroll } from '../hooks/useInfiniteScroll'
import { sanitizeHtml } from '../utils/sanitize'
import styles from './NodeDetail.module.css'

export default function NodeDetail() {
  const { name } = useParams<{ name: string }>()
  const [node, setNode] = useState<V2Node | null>(null)
  const [firstPageTopics, setFirstPageTopics] = useState<V2Topic[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  const fetchPage = useCallback(
    async (page: number) => {
      if (!name) return []
      try {
        const res = await web.nodeTopics(name, page)
        if (res.success) return res.result || []
      } catch {
        // web scraping pagination failed
      }
      return []
    },
    [name]
  )

  const { items: moreTopics, hasMore, isLoadingMore, sentinelRef, reset } =
    useInfiniteScroll<V2Topic>({
      fetchPage,
      pageSize: 20,
      enabled: !loading && totalPages > 1,
      totalPages,
    })

  const fetchData = useCallback(async () => {
    if (!name) return
    reset()
    setLoading(true)
    try {
      // Fetch node info and first page of topics in parallel
      const [nodeInfo, topicsRes] = await Promise.all([
        v1.nodeInfo(name).catch(() => null),
        web.nodeTopics(name, 1),
      ])
      if (nodeInfo) setNode(nodeInfo)
      if (topicsRes.success) {
        setFirstPageTopics(topicsRes.result || [])
        setTotalPages(topicsRes.totalPages || 1)
      }
    } catch {
      // fetch failed
    } finally {
      setLoading(false)
    }
  }, [name, reset])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const allTopics = [...firstPageTopics, ...moreTopics]

  const { pullDistance, status, pullStyle } = usePullToRefresh({
    onRefresh: async () => {
      reset()
      await fetchData()
    },
  })

  return (
    <div className={styles.page}>
      <Header title={node?.title || name || '节点'} showBack />

      <PullToRefreshIndicator pullDistance={pullDistance} status={status} />

      <div style={pullStyle}>
        {loading && status === 'idle' ? (
          <Loading />
        ) : (
          <>
            {node?.header?.replace(/<[^>]*>/g, '').trim() && (
              <div
                className={styles.nodeHeader}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(node!.header) }}
              />
            )}
            <div className={styles.topicCount}>
              {node?.topics ? `${node.topics} 个主题` : `${allTopics.length} 个主题`}
            </div>
            {allTopics.map((topic, i) => (
              <TopicCard key={topic.id} topic={topic} index={i} />
            ))}
            <div ref={sentinelRef} />
            {isLoadingMore && <Loading text="加载更多..." />}
            {!hasMore && allTopics.length > 0 && (
              <div className={styles.noMore}>没有更多了</div>
            )}
            {allTopics.length === 0 && (
              <div className={styles.empty}>该节点暂无主题</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
