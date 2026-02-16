import { useState, useEffect, useCallback, useRef } from 'react'
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
  const [error, setError] = useState('')
  const prevUsernameRef = useRef(username)

  // Reset page to 1 when username changes
  useEffect(() => {
    if (username !== prevUsernameRef.current) {
      prevUsernameRef.current = username
      setPage(1)
    }
  }, [username])

  // Fetch member info only once per username
  useEffect(() => {
    if (!username) return
    v1.memberInfo(username).then(setMember).catch(() => null)
  }, [username])

  // Fetch topics whenever username or page changes
  const fetchTopics = useCallback(async () => {
    if (!username) return
    setLoading(true)
    setError('')
    try {
      const res = await web.memberTopics(username, page)
      if (res.success) {
        setTopics(res.result || [])
        setTotalPages(res.totalPages || 1)
      } else {
        setError('加载失败')
      }
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }, [username, page])

  useEffect(() => {
    fetchTopics()
  }, [fetchTopics])

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const { pullDistance, status, pullStyle } = usePullToRefresh({
    onRefresh: fetchTopics,
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

        {error ? (
          <div className={styles.empty}>
            <p>{error}</p>
            <button onClick={fetchTopics} style={{ marginTop: 12, padding: '6px 20px', background: 'var(--accent)', color: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', fontSize: '0.85rem', fontWeight: 600 }}>
              重试
            </button>
          </div>
        ) : (
          <>
            {displayTopics.map((topic) => (
              <TopicCard key={topic.id} topic={topic} />
            ))}

            {displayTopics.length === 0 && (
              <div className={styles.empty}>暂无主题</div>
            )}

            <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
          </>
        )}
      </div>
    </div>
  )
}
