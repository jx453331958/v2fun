import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { v2 } from '../api/client'
import type { V2Member } from '../types'

interface AuthState {
  token: string | null
  member: V2Member | null
  loading: boolean
  login: (token: string) => Promise<boolean>
  logout: () => void
  isLoggedIn: boolean
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('v2fun_token'))
  const [member, setMember] = useState<V2Member | null>(null)
  const [loading, setLoading] = useState(!!localStorage.getItem('v2fun_token'))

  const fetchMember = useCallback(async () => {
    try {
      setLoading(true)
      const res = await v2.member()
      if (res.success) {
        setMember(res.result)
      }
    } catch {
      localStorage.removeItem('v2fun_token')
      setToken(null)
      setMember(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (token) {
      fetchMember()
    }
  }, [token, fetchMember])

  const login = async (newToken: string) => {
    localStorage.setItem('v2fun_token', newToken)
    setToken(newToken)
    try {
      setLoading(true)
      const res = await v2.member()
      if (res.success) {
        setMember(res.result)
        return true
      }
      localStorage.removeItem('v2fun_token')
      setToken(null)
      return false
    } catch {
      localStorage.removeItem('v2fun_token')
      setToken(null)
      return false
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('v2fun_token')
    setToken(null)
    setMember(null)
  }

  return (
    <AuthContext.Provider value={{ token, member, loading, login, logout, isLoggedIn: !!member }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
