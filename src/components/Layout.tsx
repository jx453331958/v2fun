import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import styles from './Layout.module.css'

function getActiveTab(pathname: string): string {
  if (pathname === '/' || pathname.startsWith('/topic/')) return 'home'
  if (pathname === '/nodes' || pathname.startsWith('/node/')) return 'nodes'
  if (pathname === '/notifications') return 'notifications'
  if (pathname === '/profile' || pathname === '/login') return 'profile'
  return ''
}

export default function Layout() {
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const activeTab = getActiveTab(pathname)

  return (
    <div className={styles.layout}>
      <main className={styles.main}>
        <Outlet />
      </main>

      <nav className={styles.tabBar}>
        <button
          className={`${styles.tab} ${activeTab === 'home' ? styles.active : ''}`}
          onClick={() => navigate('/')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span className={styles.tabLabel}>首页</span>
        </button>

        <button
          className={`${styles.tab} ${activeTab === 'nodes' ? styles.active : ''}`}
          onClick={() => navigate('/nodes')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
          </svg>
          <span className={styles.tabLabel}>节点</span>
        </button>

        <button
          className={styles.createBtn}
          onClick={() => navigate('/create')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        <button
          className={`${styles.tab} ${activeTab === 'notifications' ? styles.active : ''}`}
          onClick={() => navigate('/notifications')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          <span className={styles.tabLabel}>通知</span>
        </button>

        <button
          className={`${styles.tab} ${activeTab === 'profile' ? styles.active : ''}`}
          onClick={() => navigate(isLoggedIn ? '/profile' : '/login')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span className={styles.tabLabel}>我的</span>
        </button>
      </nav>
    </div>
  )
}
