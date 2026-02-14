import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { motion } from 'framer-motion'
import { v1, v2 } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import type { V2Topic, V2Reply } from '../types'
import Header from '../components/Header'
import ReplyItem from '../components/ReplyItem'
import Loading from '../components/Loading'
import styles from './TopicDetail.module.css'

export default function TopicDetail() {
  const { id } = useParams<{ id: string }>()
  const { isLoggedIn } = useAuth()
  const [topic, setTopic] = useState<V2Topic | null>(null)
  const [replies, setReplies] = useState<V2Reply[]>([])
  const [loading, setLoading] = useState(true)
  const [replyContent, setReplyContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [thanked, setThanked] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!id) return
    const topicId = parseInt(id)
    setLoading(true)
    Promise.all([
      v1.topicById(topicId).then((arr) => arr[0]),
      v1.replies(topicId),
    ])
      .then(([t, r]) => {
        setTopic(t)
        setReplies(r)
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleReply = async () => {
    if (!replyContent.trim() || !id || submitting) return
    setSubmitting(true)
    try {
      await v2.replyTopic(parseInt(id), replyContent)
      setReplyContent('')
      const r = await v1.replies(parseInt(id))
      setReplies(r)
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

  if (loading) {
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

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <article className={styles.topic}>
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

          <h1 className={styles.title}>{topic.title}</h1>

          {topic.content_rendered && (
            <div
              className={`${styles.content} rendered-content`}
              dangerouslySetInnerHTML={{ __html: topic.content_rendered }}
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
          {replies.length === 0 ? (
            <div className={styles.noReplies}>暂无回复，来说两句？</div>
          ) : (
            replies.map((reply, i) => (
              <ReplyItem key={reply.id} reply={reply} floor={i + 1} />
            ))
          )}
        </div>
      </motion.div>

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
