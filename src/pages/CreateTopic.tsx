import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { v1, web } from '../api/client'
import type { V2Node } from '../types'
import { useAuth } from '../hooks/useAuth'
import Header from '../components/Header'
import styles from './CreateTopic.module.css'

export default function CreateTopic() {
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const prefilledNode = searchParams.get('node') || ''
  const [nodeName, setNodeName] = useState(prefilledNode)
  const [nodeInput, setNodeInput] = useState(prefilledNode)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [syntax, setSyntax] = useState('default')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [allNodes, setAllNodes] = useState<V2Node[]>([])
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => {
    v1.allNodes().then((nodes) => {
      const sorted = [...nodes].sort((a, b) => b.topics - a.topics)
      setAllNodes(sorted)
      // If prefilled, resolve display text
      if (prefilledNode) {
        const found = nodes.find(n => n.name === prefilledNode)
        if (found) setNodeInput(`${found.title} - ${found.name}`)
      }
    })
  }, [prefilledNode])

  const filtered = useMemo(() => {
    if (!nodeInput.trim()) return allNodes.slice(0, 8)
    const q = nodeInput.toLowerCase()
    return allNodes
      .filter(n => n.title.toLowerCase().includes(q) || n.name.toLowerCase().includes(q))
      .slice(0, 8)
  }, [allNodes, nodeInput])

  const selectNode = (node: V2Node) => {
    setNodeName(node.name)
    setNodeInput(`${node.title} - ${node.name}`)
    setShowDropdown(false)
  }

  // Auto-expand textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.max(120, el.scrollHeight) + 'px'
  }, [content])

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('请输入标题')
      return
    }
    if (!nodeName.trim()) {
      setError('请选择节点')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const res = await web.createTopic(title.trim(), content, nodeName.trim(), syntax)
      if (res.success && res.topicId) {
        navigate(`/topic/${res.topicId}`, { replace: true })
      } else {
        setError(res.message || '发布失败，请稍后重试')
      }
    } catch {
      setError('网络错误，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isLoggedIn) {
    return (
      <div className={styles.page}>
        <Header title="发布主题" showBack />
        <div className={styles.loginPrompt}>
          <p>登录后发布主题</p>
          <button className={styles.loginBtn} onClick={() => navigate('/login')}>
            去登录
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <Header title="发布主题" showBack />

      <div className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label}>节点</label>
          <div className={styles.nodeInputWrap}>
            <input
              className={styles.input}
              type="text"
              placeholder="搜索节点，如 Python、程序员"
              value={nodeInput}
              onChange={e => {
                setNodeInput(e.target.value)
                setNodeName('')
                setShowDropdown(true)
              }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setShowDropdown(false)}
              onKeyDown={e => {
                if (e.key === 'Escape') setShowDropdown(false)
              }}
              disabled={submitting}
            />
            {showDropdown && filtered.length > 0 && (
              <div
                ref={dropdownRef}
                className={styles.dropdown}
                onMouseDown={e => e.preventDefault()}
              >
                {filtered.map(node => (
                  <button
                    key={node.id}
                    className={`${styles.dropdownItem} ${nodeName === node.name ? styles.dropdownItemSelected : ''}`}
                    onClick={() => selectNode(node)}
                    type="button"
                  >
                    <span className={styles.dropdownTitle}>{node.title}</span>
                    <span className={styles.dropdownName}>{node.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>标题</label>
          <input
            className={styles.input}
            type="text"
            placeholder="主题标题"
            value={title}
            onChange={e => setTitle(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>正文</label>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            placeholder="正文内容（可选）"
            value={content}
            onChange={e => setContent(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>格式</label>
          <div className={styles.syntaxToggle}>
            <button
              className={`${styles.syntaxBtn} ${syntax === 'default' ? styles.syntaxActive : ''}`}
              onClick={() => setSyntax('default')}
              disabled={submitting}
            >
              Default
            </button>
            <button
              className={`${styles.syntaxBtn} ${syntax === 'markdown' ? styles.syntaxActive : ''}`}
              onClick={() => setSyntax('markdown')}
              disabled={submitting}
            >
              Markdown
            </button>
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <button
          className={styles.submitBtn}
          onClick={handleSubmit}
          disabled={submitting || !title.trim() || !nodeName.trim()}
        >
          {submitting ? '发布中...' : '发布主题'}
        </button>
      </div>
    </div>
  )
}
