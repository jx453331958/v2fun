import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import type { V2Topic } from '../types'
import styles from './TopicCard.module.css'

interface Props {
  topic: V2Topic
  index?: number
}

export default function TopicCard({ topic }: Props) {
  const navigate = useNavigate()
  const timeAgo = formatDistanceToNow(new Date(topic.created * 1000), {
    locale: zhCN,
    addSuffix: true,
  })

  return (
    <article
      className={styles.card}
      onClick={() => navigate(`/topic/${topic.id}`)}
    >
      <div className={styles.meta}>
        {topic.member && (
          <div
            className={styles.avatar}
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/member/${topic.member.username}`)
            }}
          >
            <img
              src={topic.member.avatar_normal || topic.member.avatar}
              alt={topic.member.username}
              loading="lazy"
            />
          </div>
        )}
        <div className={styles.info}>
          {topic.member && (
            <span
              className={styles.username}
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/member/${topic.member.username}`)
              }}
            >
              {topic.member.username}
            </span>
          )}
          <div className={styles.details}>
            <span className={styles.time}>{timeAgo}</span>
            {topic.node && (
              <>
                <span className={styles.dot} />
                <span
                  className={styles.node}
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/node/${topic.node.name}`)
                  }}
                >
                  {topic.node.title}
                </span>
              </>
            )}
          </div>
        </div>
        {topic.replies > 0 && (
          <div className={styles.replies}>
            <span>{topic.replies}</span>
          </div>
        )}
      </div>
      <h3 className={styles.title}>{topic.title}</h3>
    </article>
  )
}
