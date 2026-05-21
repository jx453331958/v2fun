import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MdEditor } from 'md-editor-rt'
import 'md-editor-rt/lib/style.css'
import { v1, web } from '../api/client'
import type { V2Node } from '../types'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { useIsDesktop } from '../hooks/useIsDesktop'
import Header from '../components/Header'
import ConfirmDialog from '../components/ConfirmDialog'
import styles from './CreateTopic.module.css'

// 草稿自动保存：每次 title/content/node 变化 → debounce 500ms 写一次 localStorage。
// 成功发布或用户主动丢弃时清空。私密浏览或配额满 → 静默失败，不阻塞编辑流程。
const DRAFT_KEY = 'v2fun:draft:create-topic'
const DRAFT_DEBOUNCE_MS = 500

interface Draft {
  title: string
  content: string
  nodeName: string
  nodeInput: string
  savedAt: number
}

export default function CreateTopic() {
  const { isLoggedIn } = useAuth()
  const { theme } = useTheme()
  const isDesktop = useIsDesktop()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const prefilledNode = searchParams.get('node') || ''
  const [nodeName, setNodeName] = useState(prefilledNode)
  const [nodeInput, setNodeInput] = useState(prefilledNode)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [allNodes, setAllNodes] = useState<V2Node[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)

  // 首次挂载：尝试从 localStorage 恢复草稿。URL 带 ?node= 时说明用户
  // 从某节点入口进来，节点信息以 URL 为准（避免旧草稿覆盖明确意图），
  // 但 title/content 仍恢复。
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const draft = JSON.parse(raw) as Partial<Draft>
      if (typeof draft.title === 'string') setTitle(draft.title)
      if (typeof draft.content === 'string') setContent(draft.content)
      if (!prefilledNode) {
        if (typeof draft.nodeName === 'string') setNodeName(draft.nodeName)
        if (typeof draft.nodeInput === 'string') setNodeInput(draft.nodeInput)
      }
    } catch { /* corrupted draft – ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // 自动保存：任一字段变化都重置 debounce。完全为空时主动清掉 localStorage。
  useEffect(() => {
    const hasContent = title.trim() || content.trim() || nodeName.trim() || nodeInput.trim()
    if (!hasContent) {
      try { localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
      return
    }
    const t = setTimeout(() => {
      try {
        const draft: Draft = { title, content, nodeName, nodeInput, savedAt: Date.now() }
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
      } catch { /* quota / private mode – silently fail */ }
    }, DRAFT_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [title, content, nodeName, nodeInput])

  const hasDraftContent = !!(title.trim() || content.trim() || nodeName.trim() || nodeInput.trim())

  const discardDraft = () => {
    setTitle('')
    setContent('')
    if (!prefilledNode) {
      setNodeName('')
      setNodeInput('')
    }
    setError('')
    try { localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
    setDiscardOpen(false)
  }

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

  // md-editor-rt 在 paste/拖图/工具栏上传图片时调此回调；我们转给后端的 /web/upload-image
  // 并把返回的 URL 喂回编辑器，它会自动插入 ![](url) 到光标位置。
  const onUploadImg = async (files: File[], callback: (urls: string[]) => void) => {
    const results: string[] = []
    for (const file of files) {
      try {
        const res = await web.uploadImage(file)
        if (res.success && res.url) {
          results.push(`${window.location.origin}${res.url}`)
        }
      } catch { /* 单张失败跳过，其余继续 */ }
    }
    callback(results)
  }

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
      // 永远以 Markdown 提交；V2EX 的 default 模式不解析 ![](url) 图片语法
      const res = await web.createTopic(title.trim(), content, nodeName.trim(), 'markdown')
      if (res.success && res.topicId) {
        // 发布成功后清掉草稿，避免下次进入还看到已经发出去的内容
        try { localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
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

        <div className={`${styles.field} ${styles.editorWrap}`}>
          <label className={styles.label}>正文</label>
          <MdEditor
            value={content}
            onChange={setContent}
            onUploadImg={onUploadImg}
            theme={theme}
            language="zh-CN"
            placeholder="支持 Markdown；直接 Cmd+V 粘贴图片可自动上传"
            preview={isDesktop}
            toolbarsExclude={[
              'github', 'save', 'mermaid', 'katex',
              'sub', 'sup', 'task',
              // 保留 'preview' 作为切换开关；多个预览模式按钮挤工具栏不必要
              'previewOnly', 'htmlPreview', 'catalog',
            ]}
            footers={['markdownTotal', 'scrollSwitch']}
          />
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <button
          className={styles.submitBtn}
          onClick={handleSubmit}
          disabled={submitting || !title.trim() || !nodeName.trim()}
        >
          {submitting ? '发布中...' : '发布主题'}
        </button>

        {hasDraftContent && !submitting && (
          <button
            type="button"
            className={styles.discardBtn}
            onClick={() => setDiscardOpen(true)}
          >
            丢弃草稿
          </button>
        )}
      </div>

      <ConfirmDialog
        open={discardOpen}
        title="丢弃当前草稿?"
        message="此操作不可撤销,标题和正文都会被清空。"
        confirmText="确认丢弃"
        onConfirm={discardDraft}
        onCancel={() => setDiscardOpen(false)}
      />
    </div>
  )
}
