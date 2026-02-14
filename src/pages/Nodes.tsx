import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { v1 } from '../api/client'
import type { V2Node } from '../types'
import Loading from '../components/Loading'
import styles from './Nodes.module.css'

export default function Nodes() {
  const navigate = useNavigate()
  const [nodes, setNodes] = useState<V2Node[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    v1.allNodes()
      .then(setNodes)
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const sorted = [...nodes].sort((a, b) => b.topics - a.topics)
    if (!search.trim()) return sorted.slice(0, 100)
    const q = search.toLowerCase()
    return sorted.filter(
      (n) => n.title.toLowerCase().includes(q) || n.name.toLowerCase().includes(q)
    )
  }, [nodes, search])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>节点</h1>
        <div className={styles.searchWrap}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className={styles.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索节点..."
          />
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : (
        <div className={styles.grid}>
          {filtered.map((node, i) => (
            <motion.button
              key={node.id}
              className={styles.nodeCard}
              onClick={() => navigate(`/node/${node.name}`)}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25, delay: i * 0.02 }}
            >
              <div className={styles.nodeTitle}>{node.title}</div>
              <div className={styles.nodeMeta}>
                <span className={styles.nodeName}>{node.name}</span>
                <span className={styles.nodeTopics}>{node.topics}</span>
              </div>
            </motion.button>
          ))}
          {filtered.length === 0 && (
            <div className={styles.empty}>没有找到匹配的节点</div>
          )}
        </div>
      )}
    </div>
  )
}
