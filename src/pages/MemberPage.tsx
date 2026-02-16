import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { v1, web } from '../api/client'
import type { V2Member, V2Topic } from '../types'
import Header from '../components/Header'
import TopicCard from '../components/TopicCard'
import Loading from '../components/Loading'
import Pagination from '../components/Pagination'
import PullToRefreshIndicator from '../components/PullToRefreshIndicator'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import styles from './MemberPage.module.css'

export default function MemberPage() {
  const { username } = useParams<{ username: string }>()
  const [member, setMember] = useState<V2Member | null>(null)
  const [topics, setTopics] = useState<V2Topic[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  const fetchTopics = useCallback(async (p: number) => {
    if (!username) return
    setLoading(true)
    try {
      const topicsRes = await web.memberTopics(username, p)
      if (topicsRes.success) {
        setTopics(topicsRes.result || [])
        setTotalPages(topicsRes.totalPages || 1)
      }
    } finally {
      setLoading(false)
    }
  }, [username])

  useEffect(() => {
    if (!username) return
    setPage(1)
    setLoading(true)
    Promise.all([
      v1.memberInfo(username),
      web.memberTopics(username, 1),
    ]).then(([m, topicsRes]) => {
      setMember(m)
      if (topicsRes.success) {
        setTopics(topicsRes.result || [])
        setTotalPages(topicsRes.totalPages || 1)
      }
    }).finally(() => setLoading(false))
  }, [username])

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    fetchTopics(newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const { pullDistance, status, pullStyle } = usePullToRefresh({
    onRefresh: () => fetchTopics(page),
  })

  // Scraping /member/{username}/topics doesn't include avatars in topic entries,
  // so fill them in from the member profile we already fetched via V1 API.
  const memberAvatar = member?.avatar_large || member?.avatar || ''
  const displayTopics = topics.map((t) =>
    t.member.avatar ? t : { ...t, member: { ...t.member, avatar: memberAvatar, avatar_mini: memberAvatar, avatar_normal: memberAvatar, avatar_large: memberAvatar } }
  )

  if (loading && status === 'idle') {
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

      <PullToRefreshIndicator pullDistance={pullDistance} status={status} />

      <div style={pullStyle}>
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
          主题
        </div>

        {displayTopics.map((topic) => (
          <TopicCard key={topic.id} topic={topic} />
        ))}

        {displayTopics.length === 0 && (
          <div className={styles.empty}>暂无主题</div>
        )}

        <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
      </div>
    </div>
  )
}
