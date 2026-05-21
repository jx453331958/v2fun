import { createContext, useEffect, useMemo } from 'react'
import { Routes, Route, useLocation, useNavigationType, type Location } from 'react-router-dom'

/**
 * The true URL location. Layout needs this for sidebar-tab highlighting
 * because the outer <Routes location={backgroundLocation ?? location}>
 * override means useLocation() inside Layout returns the background
 * pathname (e.g. "/" when Profile modal is open) instead of the real URL.
 */
export const UrlLocationContext = createContext<Location | null>(null)
import Layout from './components/Layout'
import Home from './pages/Home'
import TopicDetail from './pages/TopicDetail'
import Login from './pages/Login'
import CreateTopic from './pages/CreateTopic'
import Profile from './pages/Profile'
import ProfileModal from './components/ProfileModal'
import Nodes from './pages/Nodes'
import NodeDetail from './pages/NodeDetail'
import Notifications from './pages/Notifications'
import MemberPage from './pages/MemberPage'
import Search from './pages/Search'
import { useIsDesktop } from './hooks/useIsDesktop'

function ScrollToTop() {
  const { pathname } = useLocation()
  const navType = useNavigationType()
  useEffect(() => {
    // Disable browser's built-in scroll restoration to prevent it from
    // racing with our manual scroll management on POP navigation.
    if (window.history.scrollRestoration !== 'manual') {
      window.history.scrollRestoration = 'manual'
    }
  }, [])
  useEffect(() => {
    if (navType !== 'POP') {
      window.scrollTo(0, 0)
    }
  }, [pathname, navType])
  return null
}

export default function App() {
  const location = useLocation()
  const isDesktop = useIsDesktop()

  // Desktop overlay routing: render Profile as a modal on top of a background
  // page. Two ways the background gets set:
  //   1. Sidebar 我的 click passes `state.background = current location` (Layout.tsx).
  //   2. Direct-load of /profile on desktop with no background — App fakes
  //      one ("/" by default) so the modal still has something to float over.
  const explicitBg = (location.state as { background?: Location } | null)?.background
  const backgroundLocation = useMemo<Location | undefined>(() => {
    if (explicitBg) return explicitBg
    if (isDesktop && location.pathname === '/profile') {
      return {
        pathname: '/',
        search: '',
        hash: '',
        state: null,
        key: 'profile-default-bg',
      }
    }
    return undefined
  }, [explicitBg, isDesktop, location.pathname])

  return (
    <UrlLocationContext.Provider value={location}>
    <ScrollToTop />
    <Routes location={backgroundLocation ?? location}>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/nodes" element={<Nodes />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/topic/:id" element={<TopicDetail />} />
        <Route path="/create" element={<CreateTopic />} />
        <Route path="/login" element={<Login />} />
        <Route path="/node/:name" element={<NodeDetail />} />
        <Route path="/member/:username" element={<MemberPage />} />
        <Route path="/search" element={<Search />} />
      </Route>
    </Routes>
    {backgroundLocation && (
      <Routes>
        <Route path="/profile" element={<ProfileModal />} />
      </Routes>
    )}
    </UrlLocationContext.Provider>
  )
}
