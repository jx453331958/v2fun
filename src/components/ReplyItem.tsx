import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { getTopicWebUrl } from '../api/client'
import type { V2Reply } from '../types'
import { sanitizeHtml } from '../utils/sanitize'
import styles from './ReplyItem.module.css'

interface Props {
  reply: V2Reply
  floor: number
  topicId: number
  highlight?: boolean
}

export default function ReplyItem({ reply, floor, topicId, highlight }: Props) {
  const navigate = useNavigate()

  const timeAgo = formatDistanceToNow(new Date(reply.created * 1000), {
    locale: zhCN,
    addSuffix: true,
  })

  const handleThank = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.open(getTopicWebUrl(topicId), '_blank')
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
          <span
            className={styles.username}
            onClick={() => navigate(`/member/${reply.member.username}`)}
          >
            {reply.member.username}
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
          <button
            className={`${styles.thankBtn} ${reply.thanked ? styles.thanked : ''}`}
            onClick={handleThank}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={reply.thanked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
            {reply.thanks > 0 && <span>{reply.thanks}</span>}
          </button>
        </div>
      </div>
    </div>
  )
}
