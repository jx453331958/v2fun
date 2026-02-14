import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { v1, v2 } from '../api/client'
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
  // V2 notification API only returns { username } in member — fetch avatars via V1 API
  const [avatarMap, setAvatarMap] = useState<Record<string, string>>({})
  const fetchedUsersRef = useRef<Set<string>>(new Set())

  const fetchAvatars = useCallback(async (notifications: V2Notification[]) => {
    const usernames = [...new Set(
      notifications.map((n) => n.member?.username).filter((u): u is string => !!u)
    )]
    const missing = usernames.filter((u) => !fetchedUsersRef.current.has(u))
    if (missing.length === 0) return

    // Mark as fetched immediately to avoid duplicate requests
    for (const u of missing) fetchedUsersRef.current.add(u)

    const results = await Promise.allSettled(
      missing.map((u) =>
        v1.memberInfo(u).then((m) =>
          [u, fixAvatarUrl(m.avatar_normal || m.avatar_large || m.avatar)] as const
        )
      )
    )
    const newEntries: Record<string, string> = {}
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value[1]) {
        newEntries[r.value[0]] = r.value[1]
      }
    }
    if (Object.keys(newEntries).length > 0) {
      setAvatarMap((prev) => ({ ...prev, ...newEntries }))
    }
  }, [])

  const fetchFirstPage = useCallback(async () => {
    if (!isLoggedIn) return
    setLoading(true)
    try {
      const res = await v2.notifications(1)
      if (res.success) {
        const list = res.result || []
        setFirstPageNotifications(list)
        fetchAvatars(list)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [isLoggedIn, fetchAvatars])

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

  // Fetch avatars for newly loaded pages
  useEffect(() => {
    if (moreNotifications.length > 0) fetchAvatars(moreNotifications)
  }, [moreNotifications, fetchAvatars])

  const { pullDistance, status, pullStyle } = usePullToRefresh({
    onRefresh: async () => {
      reset()
      fetchedUsersRef.current.clear()
      await fetchFirstPage()
    },
  })

  const navigateToTopic = useCallback((topicId: number, replyFloor?: number) => {
    navigate(`/topic/${topicId}`, {
      state: replyFloor ? { scrollToFloor: replyFloor } : undefined,
    })
  }, [navigate])

  const handleItemClick = (notif: V2Notification, e: React.MouseEvent) => {
    // Check if clicked on a topic link inside the notification HTML
    const target = e.target as HTMLElement
    const anchor = target.closest('a')
    if (anchor) {
      e.preventDefault()
      const href = anchor.getAttribute('href') || ''
      const parsed = parseNotificationLink(href)
      if (parsed && parsed.type === 'topic') {
        navigateToTopic(parsed.topicId, parsed.replyFloor)
        return
      }
      // Member links and other links fall through to topic navigation below
      // (avatar click handler already provides member page navigation)
    }

    // Navigate to the topic referenced in this notification
    const parsed = parseNotification(notif.payload_rendered || notif.text || '')
    if (parsed) {
      navigateToTopic(parsed.topicId, parsed.replyFloor)
    }
  }

  const getAvatar = (notif: V2Notification): string => {
    const m = notif.member
    if (!m) return ''
    // Try the notification member's own fields first, then the fetched map
    return fixAvatarUrl(m.avatar_normal || m.avatar_mini || m.avatar_large || m.avatar)
      || avatarMap[m.username]
      || ''
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
                {notif.member && (
                  <div
                    className={styles.itemAvatar}
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/member/${notif.member.username}`)
                    }}
                  >
                    {getAvatar(notif) ? (
                      <img src={getAvatar(notif)} alt={notif.member.username} />
                    ) : (
                      <span className={styles.avatarPlaceholder}>
                        {notif.member.username.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                )}
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
