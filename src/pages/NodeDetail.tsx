import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { v1, web } from '../api/client'
import type { V2Topic, V2Node } from '../types'
import Header from '../components/Header'
import TopicCard from '../components/TopicCard'
import Loading from '../components/Loading'
import Pagination from '../components/Pagination'
import PullToRefreshIndicator from '../components/PullToRefreshIndicator'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { sanitizeHtml } from '../utils/sanitize'
import styles from './NodeDetail.module.css'

export default function NodeDetail() {
  const { name } = useParams<{ name: string }>()
  const [node, setNode] = useState<V2Node | null>(null)
  const [topics, setTopics] = useState<V2Topic[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  const fetchTopics = useCallback(async (p: number) => {
    if (!name) return
    setLoading(true)
    try {
      const topicsRes = await web.nodeTopics(name, p)
      if (topicsRes.success) {
        setTopics(topicsRes.result || [])
        setTotalPages(topicsRes.totalPages || 1)
      }
    } catch {
      // fetch failed
    } finally {
      setLoading(false)
    }
  }, [name])

  useEffect(() => {
    if (!name) return
    setPage(1)
    setLoading(true)
    // Fetch node info and first page of topics in parallel
    Promise.all([
      v1.nodeInfo(name).catch(() => null),
      web.nodeTopics(name, 1),
    ]).then(([nodeInfo, topicsRes]) => {
      if (nodeInfo) setNode(nodeInfo)
      if (topicsRes.success) {
        setTopics(topicsRes.result || [])
        setTotalPages(topicsRes.totalPages || 1)
      }
    }).finally(() => setLoading(false))
  }, [name])

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    fetchTopics(newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const { pullDistance, status, pullStyle } = usePullToRefresh({
    onRefresh: () => fetchTopics(page),
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
              {node?.topics ? `${node.topics} 个主题` : `${topics.length} 个主题`}
            </div>
            {topics.map((topic, i) => (
              <TopicCard key={topic.id} topic={topic} index={i} />
            ))}
            {topics.length === 0 && (
              <div className={styles.empty}>该节点暂无主题</div>
            )}
            <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
          </>
        )}
      </div>
    </div>
  )
}
