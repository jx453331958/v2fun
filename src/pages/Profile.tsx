import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useAuth } from '../hooks/useAuth'
import { useBlockedNodes } from '../hooks/useBlockedNodes'
import { useBlockedUsers } from '../hooks/useBlockedUsers'
import Loading from '../components/Loading'
import ThemeSettings from '../components/ThemeSettings'
import type { V2Member } from '../types'
import styles from './Profile.module.css'

interface ProfileProps {
  /** Render only the inner sections (no .page/.stickyHeader/.panel).
   *  Used when ProfileModal already provides the surrounding chrome. */
  inModal?: boolean
}

export default function Profile({ inModal = false }: ProfileProps = {}) {
  const { member, loading, logout, isLoggedIn } = useAuth()
  const { blockedNodes, unblockNode } = useBlockedNodes()
  const { blockedUsers, unblockUser } = useBlockedUsers()
  const navigate = useNavigate()

  if (loading) return <Loading />

  if (!isLoggedIn || !member) {
    navigate('/login', { replace: true })
    return null
  }

  const handleLogout = () => {
    if (confirm('确定要退出登录吗？')) {
      logout()
      navigate('/', { replace: true })
    }
  }

  const body = (
    <ProfileBody
      member={member}
      blockedNodes={blockedNodes}
      onUnblockNode={unblockNode}
      blockedUsers={blockedUsers}
      onUnblockUser={unblockUser}
      onGoToTopics={() => navigate('/my-topics')}
      onLogout={handleLogout}
    />
  )

  if (inModal) {
    return body
  }

  return (
    <div className={styles.page}>
      <div className={styles.stickyHeader}>
        <h1 className={styles.stickyTitle}>我的</h1>
      </div>

      <div className={styles.panel}>{body}</div>
    </div>
  )
}

interface BodyProps {
  member: V2Member
  blockedNodes: string[]
  onUnblockNode: (name: string) => void
  blockedUsers: string[]
  onUnblockUser: (username: string) => void
  onGoToTopics: () => void
  onLogout: () => void
}

function ProfileBody({ member, blockedNodes, onUnblockNode, blockedUsers, onUnblockUser, onGoToTopics, onLogout }: BodyProps): ReactNode {
  const joinedAgo = formatDistanceToNow(new Date(member.created * 1000), {
    locale: zhCN,
    addSuffix: true,
  })

  return (
    <>
      <section className={styles.identity}>
        <div className={styles.avatar}>
          <img src={member.avatar_large || member.avatar} alt={member.username} />
        </div>
        <div className={styles.identityMeta}>
          <h2 className={styles.username}>{member.username}</h2>
          {member.tagline && <p className={styles.tagline}>{member.tagline}</p>}
          <p className={styles.joinDate}>加入于 {joinedAgo}</p>
          <div className={styles.identityLinks}>
            {member.website && (
              <a href={member.website} className={styles.identityLink} target="_blank" rel="noopener noreferrer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                </svg>
                <span>{member.website}</span>
              </a>
            )}
            {member.github && (
              <a href={`https://github.com/${member.github}`} className={styles.identityLink} target="_blank" rel="noopener noreferrer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                <span>{member.github}</span>
              </a>
            )}
            {member.twitter && (
              <a href={`https://twitter.com/${member.twitter}`} className={styles.identityLink} target="_blank" rel="noopener noreferrer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                </svg>
                <span>@{member.twitter}</span>
              </a>
            )}
            <button type="button" className={styles.identityLink} onClick={onGoToTopics}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <span>我的主题</span>
            </button>
          </div>
        </div>
      </section>

      {member.bio && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>个人简介</h3>
          <p className={styles.bio}>{member.bio}</p>
        </section>
      )}

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>外观</h3>
        <ThemeSettings />
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>已屏蔽节点</h3>
        {blockedNodes.length === 0 ? (
          <p className={styles.blockedHint}>长按列表里的节点徽章可屏蔽</p>
        ) : (
          <div className={styles.blockedList}>
            {blockedNodes.map((name) => (
              <span key={name} className={styles.blockedChip}>
                <span className={styles.blockedName}>{name}</span>
                <button
                  className={styles.blockedRemove}
                  onClick={() => onUnblockNode(name)}
                  aria-label={`解除屏蔽 ${name}`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>已屏蔽用户</h3>
        {blockedUsers.length === 0 ? (
          <p className={styles.blockedHint}>长按列表里的头像或用户名可屏蔽</p>
        ) : (
          <div className={styles.blockedList}>
            {blockedUsers.map((name) => (
              <span key={name} className={styles.blockedChip}>
                <span className={styles.blockedName}>{name}</span>
                <button
                  className={styles.blockedRemove}
                  onClick={() => onUnblockUser(name)}
                  aria-label={`解除屏蔽 ${name}`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      <section className={styles.logoutSection}>
        <button className={styles.logoutBtn} onClick={onLogout}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>退出登录</span>
        </button>
      </section>

      <p className={styles.version}>V2Fun · {__COMMIT_HASH__}</p>
    </>
  )
}
