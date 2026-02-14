import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { v2 } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import type { V2Notification } from '../types'
import Loading from '../components/Loading'
import PullToRefreshIndicator from '../components/PullToRefreshIndicator'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { useInfiniteScroll } from '../hooks/useInfiniteScroll'
import { parseNotification, parseNotificationLink } from '../utils/parseNotification'
import { fixAvatarUrl } from '../utils/fixAvatarUrl'
import { sanitizeHtml } from '../utils/sanitize'
import styles from './Notifications.module.css'

export default function Notifications() {
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const [firstPageNotifications, setFirstPageNotifications] = useState<V2Notification[]>([])
  const [loading, setLoading] = useState(true)

  const fetchFirstPage = useCallback(async () => {
    if (!isLoggedIn) return
    setLoading(true)
    try {
      const res = await v2.notifications(1)
      if (res.success) setFirstPageNotifications(res.result || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [isLoggedIn])

  useEffect(() => {
    if (!isLoggedIn) {
      setLoading(false)
      return
    }
    fetchFirstPage()
  }, [isLoggedIn, fetchFirstPage])

  const fetchPage = useCallback(
    async (page: number) => {
      const res = await v2.notifications(page)
      if (res.success) return res.result || []
      return []
    },
    []
  )

  const { items: moreNotifications, hasMore, isLoadingMore, sentinelRef, reset } =
    useInfiniteScroll<V2Notification>({
      fetchPage,
      pageSize: 20,
      enabled: isLoggedIn && !loading,
    })

  const allNotifications = [...firstPageNotifications, ...moreNotifications]

  const { pullDistance, status, pullStyle } = usePullToRefresh({
    onRefresh: async () => {
      reset()
      await fetchFirstPage()
    },
  })

  const handleItemClick = (notif: V2Notification, e: React.MouseEvent) => {
    // Check if clicked on an anchor tag inside the notification
    const target = e.target as HTMLElement
    const anchor = target.closest('a')
    if (anchor) {
      e.preventDefault()
      const href = anchor.getAttribute('href') || ''
      const parsed = parseNotificationLink(href)
      if (parsed) {
        if (parsed.type === 'topic') {
          navigate(`/topic/${parsed.topicId}`, {
            state: parsed.replyFloor ? { scrollToFloor: parsed.replyFloor } : undefined,
          })
        } else if (parsed.type === 'member') {
          navigate(`/member/${parsed.username}`)
        }
        return
      }
    }

    // Clicking the whole item navigates to the topic
    const parsed = parseNotification(notif.payload_rendered || notif.text)
    if (parsed) {
      navigate(`/topic/${parsed.topicId}`, {
        state: parsed.replyFloor ? { scrollToFloor: parsed.replyFloor } : undefined,
      })
    }
  }

  if (!isLoggedIn) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>通知</h1>
        </div>
        <div className={styles.loginPrompt}>
          <p>登录后查看通知</p>
          <button className={styles.loginBtn} onClick={() => navigate('/login')}>
            去登录
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>通知</h1>
      </div>

      <PullToRefreshIndicator pullDistance={pullDistance} status={status} />

      <div style={pullStyle}>
        {loading && status === 'idle' ? (
          <Loading />
        ) : allNotifications.length === 0 ? (
          <div className={styles.empty}>暂无通知</div>
        ) : (
          <div className={styles.list}>
            {allNotifications.map((notif) => (
              <div
                key={notif.id}
                className={styles.item}
                onClick={(e) => handleItemClick(notif, e)}
              >
                <div className={styles.itemAvatar}>
                  <img
                    src={fixAvatarUrl(notif.member.avatar_normal || notif.member.avatar)}
                    alt={notif.member.username}
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/member/${notif.member.username}`)
                    }}
                  />
                </div>
                <div className={styles.itemBody}>
                  <div
                    className={styles.itemText}
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(notif.payload_rendered || notif.text) }}
                  />
                  <span className={styles.itemTime}>
                    {formatDistanceToNow(new Date(notif.created * 1000), {
                      locale: zhCN,
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>
            ))}
            <div ref={sentinelRef} />
            {isLoadingMore && <Loading text="加载更多..." />}
            {!hasMore && allNotifications.length > 0 && (
              <div className={styles.noMore}>没有更多了</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
