import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { v1, v2 } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import type { V2Topic, V2Node } from '../types'
import Header from '../components/Header'
import TopicCard from '../components/TopicCard'
import Loading from '../components/Loading'
import PullToRefreshIndicator from '../components/PullToRefreshIndicator'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { useInfiniteScroll } from '../hooks/useInfiniteScroll'
import styles from './NodeDetail.module.css'

export default function NodeDetail() {
  const { name } = useParams<{ name: string }>()
  const { isLoggedIn } = useAuth()
  const [node, setNode] = useState<V2Node | null>(null)
  const [firstPageTopics, setFirstPageTopics] = useState<V2Topic[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPage = useCallback(
    async (page: number) => {
      if (!name || !isLoggedIn) return []
      const res = await v2.nodeTopics(name, page)
      if (res.success) return res.result || []
      return []
    },
    [name, isLoggedIn]
  )

  const { items: moreTopics, hasMore, isLoadingMore, sentinelRef, reset } =
    useInfiniteScroll<V2Topic>({
      fetchPage,
      pageSize: 20,
      enabled: isLoggedIn && !loading,
    })

  const fetchData = useCallback(async () => {
    if (!name) return
    setLoading(true)
    try {
      const [n, t] = await Promise.all([
        v1.nodeInfo(name),
        isLoggedIn
          ? v2.nodeTopics(name, 1).then((res) => (res.success ? res.result || [] : []))
          : v1.topicsByNode(name),
      ])
      setNode(n)
      setFirstPageTopics(t)
    } finally {
      setLoading(false)
    }
  }, [name, isLoggedIn])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const allTopics = [...firstPageTopics, ...moreTopics]

  const { pullDistance, isRefreshing, pullStyle } = usePullToRefresh({
    onRefresh: async () => {
      reset()
      await fetchData()
    },
  })

  return (
    <div className={styles.page}>
      <Header title={node?.title || name || '节点'} showBack />

      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />

      <div style={pullStyle}>
        {loading && !isRefreshing ? (
          <Loading />
        ) : (
          <>
            {node?.header && (
              <div
                className={styles.nodeHeader}
                dangerouslySetInnerHTML={{ __html: node.header }}
              />
            )}
            <div className={styles.topicCount}>
              {allTopics.length} 个主题
            </div>
            {allTopics.map((topic, i) => (
              <TopicCard key={topic.id} topic={topic} index={i} />
            ))}
            {isLoggedIn && (
              <>
                <div ref={sentinelRef} />
                {isLoadingMore && <Loading text="加载更多..." />}
                {!hasMore && allTopics.length > 0 && (
                  <div className={styles.noMore}>没有更多了</div>
                )}
              </>
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
