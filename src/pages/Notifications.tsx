import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { motion } from 'framer-motion'
import { v2 } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import type { V2Notification } from '../types'
import Loading from '../components/Loading'
import styles from './Notifications.module.css'

export default function Notifications() {
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<V2Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isLoggedIn) {
      setLoading(false)
      return
    }
    v2.notifications()
      .then((res) => {
        if (res.success) setNotifications(res.result || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isLoggedIn])

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

      {loading ? (
        <Loading />
      ) : notifications.length === 0 ? (
        <div className={styles.empty}>暂无通知</div>
      ) : (
        <div className={styles.list}>
          {notifications.map((notif, i) => (
            <motion.div
              key={notif.id}
              className={styles.item}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.03 }}
            >
              <div className={styles.itemAvatar}>
                <img
                  src={notif.member.avatar_normal || notif.member.avatar}
                  alt={notif.member.username}
                  onClick={() => navigate(`/member/${notif.member.username}`)}
                />
              </div>
              <div className={styles.itemBody}>
                <div
                  className={styles.itemText}
                  dangerouslySetInnerHTML={{ __html: notif.payload_rendered || notif.text }}
                />
                <span className={styles.itemTime}>
                  {formatDistanceToNow(new Date(notif.created * 1000), {
                    locale: zhCN,
                    addSuffix: true,
                  })}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
