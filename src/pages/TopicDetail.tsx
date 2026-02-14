import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { v1, v2 } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import type { V2Topic, V2Reply } from '../types'
import Header from '../components/Header'
import ReplyItem from '../components/ReplyItem'
import Loading from '../components/Loading'
import PullToRefreshIndicator from '../components/PullToRefreshIndicator'
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
  const [loading, setLoading] = useState(true)
  const [replyContent, setReplyContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [thanked, setThanked] = useState(false)
  const [highlightFloor, setHighlightFloor] = useState<number | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToFloor = (location.state as { scrollToFloor?: number } | null)?.scrollToFloor

  const fetchRepliesPage = useCallback(
    async (page: number) => {
      if (!id) return []
      return v1.replies(parseInt(id), page)
    },
    [id]
  )

  const { items: moreReplies, hasMore, isLoadingMore, sentinelRef, reset, loadUpToPage } =
    useInfiniteScroll<V2Reply>({
      fetchPage: fetchRepliesPage,
      pageSize: PAGE_SIZE,
      enabled: !loading && firstPageReplies.length >= PAGE_SIZE,
    })

  const allReplies = [...firstPageReplies, ...moreReplies]

  const fetchData = useCallback(async () => {
    if (!id) return
    const topicId = parseInt(id)
    setLoading(true)
    try {
      const [t, r] = await Promise.all([
        v1.topicById(topicId).then((arr) => arr[0]),
        v1.replies(topicId, 1),
      ])
      setTopic(t)
      setFirstPageReplies(r)
    } finally {
      setLoading(false)
    }
  }, [id])

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

  const handleReply = async () => {
    if (!replyContent.trim() || !id || submitting) return
    setSubmitting(true)
    try {
      await v2.replyTopic(parseInt(id), replyContent)
      setReplyContent('')
      // Reload first page of replies
      const r = await v1.replies(parseInt(id), 1)
      setFirstPageReplies(r)
      reset()
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } catch {
      alert('回复失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  const handleThankTopic = async () => {
    if (thanked || !id) return
    try {
      await v2.thankTopic(parseInt(id))
      setThanked(true)
    } catch {
      // ignore
    }
  }

  const replyBarRef = useRef<HTMLDivElement>(null)

  const handleTextareaInput = () => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 120) + 'px'
    }
  }

  // Handle virtual keyboard on mobile — keep reply bar above keyboard
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv || !replyBarRef.current) return
    const onResize = () => {
      const bar = replyBarRef.current
      if (!bar) return
      const offset = window.innerHeight - vv.height - vv.offsetTop
      bar.style.bottom = `${Math.max(0, offset)}px`
    }
    vv.addEventListener('resize', onResize)
    vv.addEventListener('scroll', onResize)
    return () => {
      vv.removeEventListener('resize', onResize)
      vv.removeEventListener('scroll', onResize)
    }
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
              className={`${styles.actionBtn} ${thanked ? styles.thanked : ''}`}
              onClick={handleThankTopic}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={thanked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
              感谢
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
                  highlight={highlightFloor === i + 1}
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

      {isLoggedIn && (
        <div className={styles.replyBar} ref={replyBarRef}>
          <div className={styles.replyInput}>
            <textarea
              ref={textareaRef}
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              onInput={handleTextareaInput}
              placeholder="写下你的回复..."
              rows={1}
            />
            <button
              className={styles.sendBtn}
              disabled={!replyContent.trim() || submitting}
              onClick={handleReply}
            >
              {submitting ? (
                <div className={styles.sendSpinner} />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
