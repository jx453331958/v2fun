import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useIsDesktop } from '../hooks/useIsDesktop'
import styles from './Layout.module.css'

function getActiveTab(pathname: string, state?: unknown): string {
  const stateTab = (state as { activeTab?: string } | null)?.activeTab
  if (stateTab) return stateTab

  if (pathname === '/' || pathname.startsWith('/topic/')) return 'home'
  if (pathname === '/nodes' || pathname.startsWith('/node/')) return 'nodes'
  if (pathname === '/notifications') return 'notifications'
  if (pathname === '/my-topics') return 'my-topics'
  if (pathname === '/profile' || pathname === '/login') return 'profile'
  return ''
}

const ICONS = {
  home: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  nodes: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
  ),
  notifications: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  ),
  profile: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  plus: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  'my-topics': (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
}

export default function Layout() {
  const { isLoggedIn, member } = useAuth()
  const navigate = useNavigate()
  // App wraps <Routes location={backgroundLocation ?? location}>, so when
  // the Profile modal is open, useLocation() here returns the BACKGROUND
  // location (the page the modal sits on top of). That's what we want for
  // sidebar-tab highlighting — the active tab should reflect the underlying
  // page, since the modal is a transient overlay, not a real navigation.
  const location = useLocation()
  const activeTab = getActiveTab(location.pathname, location.state)
  const isDesktop = useIsDesktop()

  // Desktop: open /profile as a floating modal on top of the current page
  // rather than navigating away. App.tsx watches for state.background and
  // renders ProfileModal. Shared between the sidebar nav "我的" button and
  // the bottom-left avatar button so they behave identically — both must
  // capture the current page as background (otherwise the modal sits on
  // top of a fake Home page) and never stack /profile on /profile.
  const openProfile = () => {
    const path = isLoggedIn ? '/profile' : '/login'
    if (path !== '/profile') {
      navigate(path)
      return
    }
    const currentBg = (location.state as { background?: typeof location } | null)?.background
    // `location` here is already background-aware (see useLocation comment
    // above), so when the modal is already open it's the underlying page,
    // not "/profile". Re-clicking just re-navigates to the same background;
    // currentBg fallback handles the rare case where state was cleared.
    const bg = location.pathname === '/profile'
      ? currentBg ?? { pathname: '/', search: '', hash: '', state: null, key: 'profile-default-bg' }
      : location
    navigate(path, { state: { background: bg } })
  }

  if (isDesktop) {
    type NavItem = { key: string; label: string; path: string }
    const navItems: NavItem[] = [
      { key: 'home', label: '首页', path: '/' },
      { key: 'nodes', label: '节点', path: '/nodes' },
      { key: 'notifications', label: '通知', path: '/notifications' },
      ...(isLoggedIn ? [{ key: 'my-topics', label: '我的主题', path: '/my-topics' }] : []),
      { key: 'profile', label: '我的', path: isLoggedIn ? '/profile' : '/login' },
    ]

    return (
      <div className={styles.desktopLayout}>
        <aside className={styles.sidebar}>
          <button
            className={styles.sidebarLogo}
            onClick={() => navigate('/')}
          >
            V2Fun
          </button>

          <nav className={styles.sidebarNav}>
            {navItems.map(item => (
              <button
                key={item.key}
                className={`${styles.sidebarItem} ${activeTab === item.key ? styles.sidebarItemActive : ''}`}
                onClick={() => {
                  if (item.key === 'profile') {
                    openProfile()
                  } else {
                    navigate(item.path)
                  }
                }}
              >
                {ICONS[item.key as keyof typeof ICONS]}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <button
            className={styles.sidebarCreate}
            onClick={() => navigate('/create')}
          >
            {ICONS.plus}
            <span>发布主题</span>
          </button>

          {isLoggedIn && member && (
            <button
              className={styles.sidebarUser}
              onClick={openProfile}
            >
              <img
                className={styles.sidebarUserAvatar}
                src={member.avatar_normal || member.avatar}
                alt={member.username}
              />
              <span className={styles.sidebarUserName}>{member.username}</span>
            </button>
          )}
        </aside>

        <main className={styles.desktopMain}>
          <Outlet />
        </main>
      </div>
    )
  }

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
          {ICONS.home}
          <span className={styles.tabLabel}>首页</span>
        </button>

        <button
          className={`${styles.tab} ${activeTab === 'nodes' ? styles.active : ''}`}
          onClick={() => navigate('/nodes')}
        >
          {ICONS.nodes}
          <span className={styles.tabLabel}>节点</span>
        </button>

        <button
          className={styles.createBtn}
          onClick={() => navigate('/create')}
        >
          {ICONS.plus}
        </button>

        <button
          className={`${styles.tab} ${activeTab === 'notifications' ? styles.active : ''}`}
          onClick={() => navigate('/notifications')}
        >
          {ICONS.notifications}
          <span className={styles.tabLabel}>通知</span>
        </button>

        <button
          className={`${styles.tab} ${activeTab === 'profile' ? styles.active : ''}`}
          onClick={() => navigate(isLoggedIn ? '/profile' : '/login')}
        >
          {ICONS.profile}
          <span className={styles.tabLabel}>我的</span>
        </button>
      </nav>
    </div>
  )
}
