import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { V2Member } from '../types'

interface AuthState {
  member: V2Member | null
  loading: boolean
  login: (cookie: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  isLoggedIn: boolean
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<V2Member | null>(null)
  const [loading, setLoading] = useState(true)

  // Restore session from server on startup
  useEffect(() => {
    fetch('/auth/session', { credentials: 'same-origin' })
      .then(res => res.json())
      .then(data => {
        if (data.member) {
          setMember(data.member)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (cookie: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ cookie }),
      })
      const data = await res.json()
      if (res.ok && data.success && data.member) {
        setMember(data.member)
        return { success: true }
      }
      return { success: false, error: data.error || '登录失败' }
    } catch {
      return { success: false, error: '网络错误' }
    }
  }, [])

  const logout = useCallback(() => {
    setMember(null)
    fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {})
  }, [])

  return (
    <AuthContext.Provider value={{ member, loading, login, logout, isLoggedIn: !!member }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
