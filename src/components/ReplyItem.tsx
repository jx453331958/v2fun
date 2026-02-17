import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { web, getTopicWebUrl } from '../api/client'
import type { V2Reply } from '../types'
import { sanitizeHtml } from '../utils/sanitize'
import styles from './ReplyItem.module.css'

interface Props {
  reply: V2Reply
  floor: number
  topicId: number
  highlight?: boolean
  hasCookie?: boolean
  opUsername?: string
  onReplyTo?: (username: string, floor: number) => void
}

export default function ReplyItem({ reply, floor, topicId, highlight, hasCookie, opUsername, onReplyTo }: Props) {
  const navigate = useNavigate()
  const [thanked, setThanked] = useState(reply.thanked)
  const [thanks, setThanks] = useState(reply.thanks)
  const [thanking, setThanking] = useState(false)

  const timeAgo = formatDistanceToNow(new Date(reply.created * 1000), {
    locale: zhCN,
    addSuffix: true,
  })

  const handleThank = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (thanked || thanking) return
    if (!hasCookie) {
      window.open(getTopicWebUrl(topicId), '_blank')
      return
    }
    setThanking(true)
    try {
      const res = await web.thankReply(reply.id, topicId)
      if (res.success) {
        setThanked(true)
        setThanks(prev => prev + 1)
      } else if (res.error === 'cookie_expired') {
        alert('Cookie 已过期，请在个人页重新设置')
      }
    } catch { /* ignore */ }
    setThanking(false)
  }

  return (
    <div className={`${styles.reply} ${highlight ? styles.highlight : ''}`} id={`reply-floor-${floor}`}>
      <div className={styles.left}>
        <div
          className={styles.avatar}
          onClick={() => navigate(`/member/${reply.member.username}`)}
        >
          <img
            src={reply.member.avatar_normal || reply.member.avatar}
            alt={reply.member.username}
            loading="lazy"
          />
        </div>
      </div>
      <div className={styles.body}>
        <div className={styles.header}>
          <span className={styles.nameGroup}>
            <span
              className={styles.username}
              onClick={() => navigate(`/member/${reply.member.username}`)}
            >
              {reply.member.username}
            </span>
            {opUsername && reply.member.username === opUsername && (
              <span className={styles.opBadge}>OP</span>
            )}
          </span>
          <span className={styles.meta}>
            {timeAgo}
            <span className={styles.floor}>#{floor}</span>
          </span>
        </div>
        <div
          className={`${styles.content} rendered-content`}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(reply.content_rendered) }}
        />
        <div className={styles.actions}>
          {onReplyTo && (
            <button
              className={styles.replyBtn}
              onClick={(e) => { e.stopPropagation(); onReplyTo(reply.member.username, floor) }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </button>
          )}
          <button
            className={`${styles.thankBtn} ${thanked ? styles.thanked : ''}`}
            onClick={handleThank}
            disabled={thanking || thanked}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={thanked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
            {thanks > 0 && <span>{thanks}</span>}
          </button>
        </div>
      </div>
    </div>
  )
}
