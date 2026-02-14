import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { v1 } from '../api/client'
import type { V2Member, V2Topic } from '../types'
import Header from '../components/Header'
import TopicCard from '../components/TopicCard'
import Loading from '../components/Loading'
import styles from './MemberPage.module.css'

export default function MemberPage() {
  const { username } = useParams<{ username: string }>()
  const [member, setMember] = useState<V2Member | null>(null)
  const [topics, setTopics] = useState<V2Topic[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!username) return
    setLoading(true)
    Promise.all([
      v1.memberInfo(username),
      v1.topicsByUser(username),
    ])
      .then(([m, t]) => {
        setMember(m)
        setTopics(t)
      })
      .finally(() => setLoading(false))
  }, [username])

  if (loading) {
    return (
      <div className={styles.page}>
        <Header title={username || ''} showBack />
        <Loading />
      </div>
    )
  }

  if (!member) {
    return (
      <div className={styles.page}>
        <Header title="用户" showBack />
        <div className={styles.empty}>用户不存在</div>
      </div>
    )
  }

  const joinedAgo = formatDistanceToNow(new Date(member.created * 1000), {
    locale: zhCN,
    addSuffix: true,
  })

  return (
    <div className={styles.page}>
      <Header title={member.username} showBack />

      <div className={styles.profile}>
        <div className={styles.avatar}>
          <img src={member.avatar_large || member.avatar} alt={member.username} />
        </div>
        <div className={styles.info}>
          <h2 className={styles.username}>{member.username}</h2>
          {member.tagline && <p className={styles.tagline}>{member.tagline}</p>}
          <p className={styles.joinDate}>加入于 {joinedAgo}</p>
        </div>
      </div>

      {member.bio && (
        <div className={styles.bio}>{member.bio}</div>
      )}

      <div className={styles.topicsHeader}>
        最近主题 ({topics.length})
      </div>

      {topics.map((topic) => (
        <TopicCard key={topic.id} topic={topic} />
      ))}

      {topics.length === 0 && (
        <div className={styles.empty}>暂无主题</div>
      )}
    </div>
  )
}
