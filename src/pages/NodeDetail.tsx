import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { v1, v2 } from '../api/client'
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
  const [node, setNode] = useState<V2Node | null>(null)
  const [firstPageTopics, setFirstPageTopics] = useState<V2Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [useV2, setUseV2] = useState(false)

  const fetchPage = useCallback(
    async (page: number) => {
      if (!name) return []
      try {
        const res = await v2.nodeTopics(name, page)
        if (res.success) return res.result || []
      } catch {
        // V2 pagination failed
      }
      return []
    },
    [name]
  )

  const { items: moreTopics, hasMore, isLoadingMore, sentinelRef, reset } =
    useInfiniteScroll<V2Topic>({
      fetchPage,
      pageSize: 20,
      enabled: useV2 && !loading,
    })

  const fetchData = useCallback(async () => {
    if (!name) return
    setLoading(true)
    setUseV2(false)
    try {
      const nodeInfo = await v1.nodeInfo(name)
      setNode(nodeInfo)

      try {
        const res = await v2.nodeTopics(name, 1)
        if (res.success) {
          setFirstPageTopics(res.result || [])
          setUseV2(true)
          return
        }
      } catch {
        // V2 failed, fall through to V1
      }

      const topics = await v1.topicsByNode(name)
      setFirstPageTopics(topics)
    } catch {
      // nodeInfo or V1 topics failed
    } finally {
      setLoading(false)
    }
  }, [name])

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
                dangerouslySetInnerHTML={{ __html: node!.header }}
              />
            )}
            <div className={styles.topicCount}>
              {allTopics.length} 个主题
            </div>
            {allTopics.map((topic, i) => (
              <TopicCard key={topic.id} topic={topic} index={i} />
            ))}
            {useV2 ? (
              <>
                <div ref={sentinelRef} />
                {isLoadingMore && <Loading text="加载更多..." />}
                {!hasMore && allTopics.length > 0 && (
                  <div className={styles.noMore}>没有更多了</div>
                )}
              </>
            ) : (
              allTopics.length > 0 && (
                <div className={styles.noMore}>没有更多了</div>
              )
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
