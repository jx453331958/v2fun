import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { v1, v2 } from '../api/client'
import type { V2Node } from '../types'
import Header from '../components/Header'
import styles from './CreateTopic.module.css'

export default function CreateTopic() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [nodeName, setNodeName] = useState('')
  const [nodeSearch, setNodeSearch] = useState('')
  const [nodes, setNodes] = useState<V2Node[]>([])
  const [filteredNodes, setFilteredNodes] = useState<V2Node[]>([])
  const [showNodePicker, setShowNodePicker] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedNode, setSelectedNode] = useState<V2Node | null>(null)

  useEffect(() => {
    v1.allNodes().then(setNodes).catch(() => {})
  }, [])

  useEffect(() => {
    if (nodeSearch.trim()) {
      const q = nodeSearch.toLowerCase()
      setFilteredNodes(
        nodes
          .filter((n) => n.title.toLowerCase().includes(q) || n.name.toLowerCase().includes(q))
          .slice(0, 20)
      )
    } else {
      setFilteredNodes(nodes.sort((a, b) => b.topics - a.topics).slice(0, 20))
    }
  }, [nodeSearch, nodes])

  const handleSelectNode = (node: V2Node) => {
    setNodeName(node.name)
    setSelectedNode(node)
    setShowNodePicker(false)
    setNodeSearch('')
  }

  const handleSubmit = async () => {
    if (!title.trim() || !nodeName || submitting) return
    setSubmitting(true)
    try {
      const res = await v2.createTopic({
        title: title.trim(),
        content: content.trim(),
        node_name: nodeName,
        syntax: 'markdown',
      })
      if (res.success && res.result) {
        navigate(`/topic/${res.result.id}`, { replace: true })
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '发布失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <Header
        title="发布主题"
        showBack
        right={
          <button
            className={styles.publishBtn}
            disabled={!title.trim() || !nodeName || submitting}
            onClick={handleSubmit}
          >
            {submitting ? '发布中...' : '发布'}
          </button>
        }
      />

      <div className={styles.form}>
        <div className={styles.nodeSelector} onClick={() => setShowNodePicker(true)}>
          <span className={styles.nodeLabel}>节点</span>
          {selectedNode ? (
            <span className={styles.nodeSelected}>{selectedNode.title}</span>
          ) : (
            <span className={styles.nodePlaceholder}>选择节点</span>
          )}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        <input
          className={styles.titleInput}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="标题"
          maxLength={120}
        />

        <textarea
          className={styles.contentInput}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="正文内容（支持 Markdown）"
          rows={12}
        />

        <div className={styles.syntaxHint}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          支持 Markdown 语法
        </div>
      </div>

      {showNodePicker && (
        <div className={styles.overlay} onClick={() => setShowNodePicker(false)}>
          <motion.div
            className={styles.nodePicker}
            onClick={(e) => e.stopPropagation()}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className={styles.pickerHeader}>
              <h3>选择节点</h3>
              <button onClick={() => setShowNodePicker(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className={styles.searchWrap}>
              <input
                className={styles.searchInput}
                value={nodeSearch}
                onChange={(e) => setNodeSearch(e.target.value)}
                placeholder="搜索节点..."
                autoFocus
              />
            </div>
            <div className={styles.nodeList}>
              {filteredNodes.map((node) => (
                <button
                  key={node.id}
                  className={`${styles.nodeItem} ${node.name === nodeName ? styles.nodeItemActive : ''}`}
                  onClick={() => handleSelectNode(node)}
                >
                  <span className={styles.nodeTitle}>{node.title}</span>
                  <span className={styles.nodeMeta}>{node.name} · {node.topics} 主题</span>
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
