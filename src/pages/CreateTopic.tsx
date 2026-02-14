import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { web } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import Header from '../components/Header'
import styles from './CreateTopic.module.css'

export default function CreateTopic() {
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [nodeName, setNodeName] = useState(searchParams.get('node') || '')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [syntax, setSyntax] = useState('default')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
      setError('请输入节点名称')
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
          <input
            className={styles.input}
            type="text"
            placeholder="节点名称，如 python、programmer"
            value={nodeName}
            onChange={e => setNodeName(e.target.value)}
            disabled={submitting}
          />
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
