import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { motion } from 'framer-motion'
import type { V2Topic } from '../types'
import styles from './TopicCard.module.css'

interface Props {
  topic: V2Topic
  index?: number
}

export default function TopicCard({ topic, index = 0 }: Props) {
  const navigate = useNavigate()
  const timeAgo = formatDistanceToNow(new Date(topic.created * 1000), {
    locale: zhCN,
    addSuffix: true,
  })

  return (
    <motion.article
      className={styles.card}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: [0.25, 0.46, 0.45, 0.94] }}
      onClick={() => navigate(`/topic/${topic.id}`)}
    >
      <div className={styles.meta}>
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
        <div className={styles.info}>
          <span
            className={styles.username}
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/member/${topic.member.username}`)
            }}
          >
            {topic.member.username}
          </span>
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
    </motion.article>
  )
}
