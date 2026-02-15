import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { v1, web, getTopicWebUrl } from '../api/client'
import type { V2Topic, V2Reply } from '../types'
import Header from '../components/Header'
import ReplyItem from '../components/ReplyItem'
import Loading from '../components/Loading'
import PullToRefreshIndicator from '../components/PullToRefreshIndicator'
import { useAuth } from '../hooks/useAuth'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { useInfiniteScroll } from '../hooks/useInfiniteScroll'
import { sanitizeHtml } from '../utils/sanitize'
import styles from './TopicDetail.module.css'

const PAGE_SIZE = 100

export default function TopicDetail() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const { isLoggedIn } = useAuth()
  const [topic, setTopic] = useState<V2Topic | null>(null)
  const [firstPageReplies, setFirstPageReplies] = useState<V2Reply[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [highlightFloor, setHighlightFloor] = useState<number | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [thankedTopic, setThankedTopic] = useState(false)
  const [thankingTopic, setThankingTopic] = useState(false)
  const [replyError, setReplyError] = useState('')
  const [appendedReplies, setAppendedReplies] = useState<V2Reply[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToFloor = (location.state as { scrollToFloor?: number } | null)?.scrollToFloor

  const fetchRepliesPage = useCallback(
    async (page: number) => {
      if (!id) return []
      const data = await web.replies(parseInt(id), page)
      return data.result
    },
    [id]
  )

  const { items: moreReplies, hasMore, isLoadingMore, sentinelRef, reset, loadUpToPage } =
    useInfiniteScroll<V2Reply>({
      fetchPage: fetchRepliesPage,
      pageSize: PAGE_SIZE,
      enabled: !loading && totalPages > 1,
      totalPages,
    })

  const allReplies = [...firstPageReplies, ...moreReplies, ...appendedReplies]

  const fetchData = useCallback(async () => {
    if (!id) return
    const topicId = parseInt(id)
    reset()
    setAppendedReplies([])
    setLoading(true)
    try {
      const [t, repliesData] = await Promise.all([
        v1.topicById(topicId).then((arr) => arr[0]),
        web.replies(topicId, 1),
      ])
      setTopic(t)
      setFirstPageReplies(repliesData.result)
      setTotalPages(repliesData.totalPages)
    } finally {
      setLoading(false)
    }
  }, [id, reset])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Handle scrollToFloor after data is loaded
  useEffect(() => {
    if (!scrollToFloor || loading || !topic) return

    const doScroll = async () => {
      const targetPage = Math.ceil(scrollToFloor / PAGE_SIZE)

      if (targetPage > 1) {
        // Need to load more pages first
        // loadUpToPage puts ALL pages (1..N) into hook items,
        // so clear firstPageReplies to avoid duplicates
        await loadUpToPage(targetPage)
        setFirstPageReplies([])
        // Wait for render
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            scrollToElement(scrollToFloor)
          })
        })
      } else {
        // Already on first page, just scroll
        requestAnimationFrame(() => {
          scrollToElement(scrollToFloor)
        })
      }
    }

    doScroll()
  }, [scrollToFloor, loading, topic, loadUpToPage])

  const scrollToElement = (floor: number) => {
    const el = document.getElementById(`reply-floor-${floor}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightFloor(floor)
      setTimeout(() => setHighlightFloor(null), 2000)
    }
  }

  const { pullDistance, status, pullStyle } = usePullToRefresh({
    onRefresh: async () => {
      reset()
      await fetchData()
    },
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
        // Reset textarea height
        if (textareaRef.current) textareaRef.current.style.height = 'auto'
        // Incrementally fetch only the last page to find the new reply
        const topicId = parseInt(id)
        let lastPage = Math.max(totalPages, 1)
        let data = await web.replies(topicId, lastPage)
        // If a new page was created, fetch it
        if (data.totalPages > lastPage) {
          lastPage = data.totalPages
          setTotalPages(lastPage)
          data = await web.replies(topicId, lastPage)
        }
        // Find replies not already displayed
        const existingIds = new Set(allReplies.map(r => r.id))
        const newReplies = data.result.filter(r => !existingIds.has(r.id))
        if (newReplies.length > 0) {
          const targetFloor = allReplies.length + newReplies.length
          setAppendedReplies(prev => [...prev, ...newReplies])
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              scrollToElement(targetFloor)
            })
          })
        }
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
          {allReplies.length === 0 ? (
            <div className={styles.noReplies}>暂无回复，来说两句？</div>
          ) : (
            <>
              {allReplies.map((reply, i) => (
                <ReplyItem
                  key={reply.id}
                  reply={reply}
                  floor={i + 1}
                  topicId={parseInt(id!)}
                  highlight={highlightFloor === i + 1}
                  hasCookie={isLoggedIn}
                  onReplyTo={isLoggedIn ? handleReplyTo : undefined}
                />
              ))}
              <div ref={sentinelRef} />
              {isLoadingMore && <Loading text="加载更多回复..." />}
              {!hasMore && allReplies.length > 0 && (
                <div className={styles.noMore}>没有更多回复了</div>
              )}
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
