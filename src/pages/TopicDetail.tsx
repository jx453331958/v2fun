import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { v1, web, getTopicWebUrl } from '../api/client'
import type { V2Topic, V2Reply } from '../types'
import Header from '../components/Header'
import ReplyItem from '../components/ReplyItem'
import Loading from '../components/Loading'
import Pagination from '../components/Pagination'
import PullToRefreshIndicator from '../components/PullToRefreshIndicator'
import { useAuth } from '../hooks/useAuth'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { sanitizeHtml } from '../utils/sanitize'
import styles from './TopicDetail.module.css'

const PAGE_SIZE = 100

export default function TopicDetail() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const { isLoggedIn } = useAuth()
  const [topic, setTopic] = useState<V2Topic | null>(null)
  const [replies, setReplies] = useState<V2Reply[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [highlightFloor, setHighlightFloor] = useState<number | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [thankedTopic, setThankedTopic] = useState(false)
  const [thankingTopic, setThankingTopic] = useState(false)
  const [replyError, setReplyError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const initializedRef = useRef(false)

  const scrollToFloor = (location.state as { scrollToFloor?: number } | null)?.scrollToFloor

  const fetchReplies = useCallback(async (p: number) => {
    if (!id) return
    setLoading(true)
    try {
      const data = await web.replies(parseInt(id), p)
      setReplies(data.result)
      setTotalPages(data.totalPages)
    } finally {
      setLoading(false)
    }
  }, [id])

  // Initial load — if scrollToFloor is set, jump to that page directly
  useEffect(() => {
    if (!id || initializedRef.current) return
    initializedRef.current = true

    const initialPage = scrollToFloor ? Math.ceil(scrollToFloor / PAGE_SIZE) : 1
    setPage(initialPage)

    const topicId = parseInt(id)
    setLoading(true)
    Promise.all([
      v1.topicById(topicId).then((arr) => arr[0]),
      web.replies(topicId, initialPage),
    ]).then(([t, repliesData]) => {
      setTopic(t)
      setReplies(repliesData.result)
      setTotalPages(repliesData.totalPages)
    }).finally(() => setLoading(false))
  }, [id, scrollToFloor])

  // After data loads, scroll to the target floor element
  useEffect(() => {
    if (!scrollToFloor || loading || !topic) return
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToElement(scrollToFloor)
      })
    })
  }, [scrollToFloor, loading, topic])

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    fetchReplies(newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const scrollToElement = (floor: number) => {
    const el = document.getElementById(`reply-floor-${floor}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightFloor(floor)
      setTimeout(() => setHighlightFloor(null), 2000)
    }
  }

  const { pullDistance, status, pullStyle } = usePullToRefresh({
    onRefresh: () => fetchReplies(page),
  })

  const openInV2EX = () => {
    if (!id) return
    window.open(getTopicWebUrl(parseInt(id)), '_blank')
  }

  const handleSubmitReply = async () => {
    if (!id || !replyContent.trim() || submitting) return
    setSubmitting(true)
    setReplyError('')
    try {
      const res = await web.reply(parseInt(id), replyContent.trim())
      if (res.success) {
        setReplyContent('')
        textareaRef.current?.blur()
        if (textareaRef.current) textareaRef.current.style.height = 'auto'
        // Jump to the last page to see the new reply
        const topicId = parseInt(id)
        const data = await web.replies(topicId, totalPages)
        if (data.totalPages > totalPages) {
          const lastData = await web.replies(topicId, data.totalPages)
          setTotalPages(lastData.totalPages)
          setPage(lastData.totalPages)
          setReplies(lastData.result)
        } else {
          setTotalPages(data.totalPages)
          setPage(data.totalPages)
          setReplies(data.result)
        }
        requestAnimationFrame(() => {
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
        })
      } else if (res.error === 'cookie_expired') {
        setReplyError('Cookie 已过期，请在个人页重新设置')
      } else {
        setReplyError(res.message || '回复失败')
      }
    } catch {
      setReplyError('网络错误')
    } finally {
      setSubmitting(false)
    }
  }

  const handleThankTopic = async () => {
    if (!id || thankingTopic || thankedTopic) return
    if (!isLoggedIn) {
      openInV2EX()
      return
    }
    setThankingTopic(true)
    try {
      const res = await web.thankTopic(parseInt(id))
      if (res.success) {
        setThankedTopic(true)
      } else if (res.error === 'cookie_expired') {
        alert('Cookie 已过期，请在个人页重新设置')
      }
    } catch { /* ignore */ }
    setThankingTopic(false)
  }

  const handleReplyTo = useCallback((username: string, floor: number) => {
    const mention = `@${username} #${floor} `
    setReplyContent(prev => prev + mention)
    textareaRef.current?.focus()
  }, [])

  if (loading && status === 'idle') {
    return (
      <div className={styles.page}>
        <Header title="主题详情" showBack />
        <Loading />
      </div>
    )
  }

  if (!topic) {
    return (
      <div className={styles.page}>
        <Header title="主题详情" showBack />
        <div className={styles.empty}>主题不存在</div>
      </div>
    )
  }

  const timeAgo = formatDistanceToNow(new Date(topic.created * 1000), {
    locale: zhCN,
    addSuffix: true,
  })

  return (
    <div className={styles.page}>
      <Header title={topic.node?.title || '主题详情'} showBack />

      <PullToRefreshIndicator pullDistance={pullDistance} status={status} />

      <div style={pullStyle}>
        <article className={styles.topic}>
          {topic.member && (
            <div className={styles.topicMeta}>
              <div className={styles.avatar}>
                <img
                  src={topic.member.avatar_normal || topic.member.avatar}
                  alt={topic.member.username}
                />
              </div>
              <div className={styles.metaInfo}>
                <span className={styles.username}>{topic.member.username}</span>
                <span className={styles.time}>{timeAgo}</span>
              </div>
            </div>
          )}

          <h1 className={styles.title}>{topic.title}</h1>

          {topic.content_rendered && (
            <div
              className={`${styles.content} rendered-content`}
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(topic.content_rendered) }}
            />
          )}

          <div className={styles.topicActions}>
            <button
              className={`${styles.actionBtn} ${thankedTopic ? styles.thanked : ''}`}
              onClick={handleThankTopic}
              disabled={thankingTopic || thankedTopic}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={thankedTopic ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
              {thankedTopic ? '已感谢' : '感谢'}
            </button>
            <span className={styles.replyCount}>
              {topic.replies} 条回复
            </span>
          </div>
        </article>

        <div className={styles.repliesSection}>
          {replies.length === 0 && page === 1 ? (
            <div className={styles.noReplies}>暂无回复，来说两句？</div>
          ) : (
            <>
              {replies.map((reply, i) => (
                <ReplyItem
                  key={reply.id}
                  reply={reply}
                  floor={(page - 1) * PAGE_SIZE + i + 1}
                  topicId={parseInt(id!)}
                  highlight={highlightFloor === (page - 1) * PAGE_SIZE + i + 1}
                  hasCookie={isLoggedIn}
                  opUsername={topic.member?.username}
                  onReplyTo={isLoggedIn ? handleReplyTo : undefined}
                />
              ))}
              <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
            </>
          )}
        </div>
      </div>

      <div className={styles.replyBar}>
        {isLoggedIn ? (
          <div className={styles.replyInputRow}>
            <textarea
              ref={textareaRef}
              className={styles.textarea}
              rows={1}
              placeholder="写回复..."
              value={replyContent}
              onChange={e => { setReplyContent(e.target.value); setReplyError('') }}
              onInput={e => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = Math.min(el.scrollHeight, 120) + 'px'
              }}
              disabled={submitting}
            />
            <button
              className={styles.sendBtn}
              onClick={handleSubmitReply}
              disabled={submitting || !replyContent.trim()}
            >
              {submitting ? (
                <span className={styles.sendSpinner} />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
            {replyError && <p className={styles.replyError}>{replyError}</p>}
          </div>
        ) : (
          <button className={styles.replyWebBtn} onClick={openInV2EX}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
            </svg>
            在 V2EX 中回复
          </button>
        )}
      </div>
    </div>
  )
}
