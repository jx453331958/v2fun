import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import TopicDetail from './pages/TopicDetail'
import Login from './pages/Login'
import CreateTopic from './pages/CreateTopic'
import Profile from './pages/Profile'
import Nodes from './pages/Nodes'
import NodeDetail from './pages/NodeDetail'
import Notifications from './pages/Notifications'
import MemberPage from './pages/MemberPage'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <>
    <ScrollToTop />
    <Routes>
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
      </Route>
    </Routes>
    </>
  )
}
