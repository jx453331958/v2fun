import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import MemberPage from './MemberPage'

export default function MyTopics() {
  const { isLoggedIn, member, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !isLoggedIn) {
      navigate('/login', { replace: true })
    }
  }, [isLoggedIn, loading, navigate])

  if (loading || !member) return null

  return <MemberPage username={member.username} showBack={false} />
}
