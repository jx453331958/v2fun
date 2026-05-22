import { useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useIsDesktop } from '../hooks/useIsDesktop'
import MemberPage from './MemberPage'
import TopicDetail from './TopicDetail'
import styles from './MyTopics.module.css'

export default function MyTopics() {
  const { isLoggedIn, member, loading } = useAuth()
  const navigate = useNavigate()
  const isDesktop = useIsDesktop()
  const [searchParams, setSearchParams] = useSearchParams()

  const selectedTopicId = (() => {
    const v = searchParams.get('t')
    if (!v) return null
    const n = parseInt(v)
    return isNaN(n) ? null : n
  })()

  useEffect(() => {
    if (!loading && !isLoggedIn) {
      navigate('/login', { replace: true })
    }
  }, [isLoggedIn, loading, navigate])

  const handleSelectTopic = useCallback((topicId: number) => {
    setSearchParams({ t: String(topicId) }, { replace: false })
  }, [setSearchParams])

  if (loading || !member) return null

  if (isDesktop) {
    return (
      <div className={styles.splitPage}>
        <div className={styles.listColumn}>
          <MemberPage
            username={member.username}
            showBack={false}
            onSelect={handleSelectTopic}
            selectedTopicId={selectedTopicId}
          />
        </div>
        <div className={styles.detailColumn}>
          {selectedTopicId ? (
            <TopicDetail key={selectedTopicId} topicId={selectedTopicId} embedded />
          ) : (
            <div className={styles.detailEmpty}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <p>选择左侧话题查看详情</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return <MemberPage username={member.username} showBack={false} />
}
