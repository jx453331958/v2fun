import { useState, useEffect, useCallback, useRef } from 'react'
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
  const [error, setError] = useState('')
  const prevNameRef = useRef(name)

  // Reset page to 1 when node name changes
  useEffect(() => {
    if (name !== prevNameRef.current) {
      prevNameRef.current = name
      setPage(1)
    }
  }, [name])

  // Fetch node info only once per node name
  useEffect(() => {
    if (!name) return
    v1.nodeInfo(name).then(setNode).catch(() => null)
  }, [name])

  // Fetch topics whenever name or page changes
  const fetchTopics = useCallback(async () => {
    if (!name) return
    setLoading(true)
    setError('')
    try {
      const res = await web.nodeTopics(name, page)
      if (res.success) {
        setTopics(res.result || [])
        setTotalPages(res.totalPages || 1)
      } else {
        setError('加载失败')
      }
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }, [name, page])

  useEffect(() => {
    fetchTopics()
  }, [fetchTopics])

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const { pullDistance, status, pullStyle } = usePullToRefresh({
    onRefresh: fetchTopics,
  })

  return (
    <div className={styles.page}>
      <Header title={node?.title || name || '节点'} showBack />

      <PullToRefreshIndicator pullDistance={pullDistance} status={status} />

      <div style={pullStyle}>
        {loading && status === 'idle' ? (
          <Loading />
        ) : error ? (
          <div className={styles.empty}>
            <p>{error}</p>
            <button onClick={fetchTopics} style={{ marginTop: 12, padding: '6px 20px', background: 'var(--accent)', color: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', fontSize: '0.85rem', fontWeight: 600 }}>
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
