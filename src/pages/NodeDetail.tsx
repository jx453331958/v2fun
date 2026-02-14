import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { v1 } from '../api/client'
import type { V2Topic, V2Node } from '../types'
import Header from '../components/Header'
import TopicCard from '../components/TopicCard'
import Loading from '../components/Loading'
import styles from './NodeDetail.module.css'

export default function NodeDetail() {
  const { name } = useParams<{ name: string }>()
  const [node, setNode] = useState<V2Node | null>(null)
  const [topics, setTopics] = useState<V2Topic[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!name) return
    setLoading(true)
    Promise.all([
      v1.nodeInfo(name),
      v1.topicsByNode(name),
    ])
      .then(([n, t]) => {
        setNode(n)
        setTopics(t)
      })
      .finally(() => setLoading(false))
  }, [name])

  return (
    <div className={styles.page}>
      <Header title={node?.title || name || '节点'} showBack />

      {loading ? (
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
            {topics.length} 个主题
          </div>
          {topics.map((topic, i) => (
            <TopicCard key={topic.id} topic={topic} index={i} />
          ))}
          {topics.length === 0 && (
            <div className={styles.empty}>该节点暂无主题</div>
          )}
        </>
      )}
    </div>
  )
}
