import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import type { V2Member } from '../types'

const COOKIE_STORAGE_KEY = 'v2fun_cookie'

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
  const restoringRef = useRef(false)

  // Try to login with a cookie string (used by both manual login and auto-restore)
  const doLogin = useCallback(async (cookie: string): Promise<{ success: boolean; error?: string; member?: V2Member }> => {
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ cookie }),
      })
      const data = await res.json()
      if (res.ok && data.success && data.member) {
        return { success: true, member: data.member }
      }
      return { success: false, error: data.error || '登录失败' }
    } catch {
      return { success: false, error: '网络错误' }
    }
  }, [])

  // Restore session from server on startup; if server lost data, auto-restore from localStorage
  useEffect(() => {
    async function restore() {
      try {
        const res = await fetch('/auth/session', { credentials: 'same-origin' })
        const data = await res.json()
        if (data.member) {
          setMember(data.member)
          return
        }
      } catch { /* ignore */ }

      // Server session lost — try auto-restore from localStorage
      const savedCookie = localStorage.getItem(COOKIE_STORAGE_KEY)
      if (savedCookie) {
        restoringRef.current = true
        const result = await doLogin(savedCookie)
        restoringRef.current = false
        if (result.success && result.member) {
          setMember(result.member)
        } else {
          // Saved cookie is invalid, clean up
          localStorage.removeItem(COOKIE_STORAGE_KEY)
        }
      }
    }
    restore().finally(() => setLoading(false))
  }, [doLogin])

  const login = useCallback(async (cookie: string): Promise<{ success: boolean; error?: string }> => {
    const result = await doLogin(cookie)
    if (result.success && result.member) {
      setMember(result.member)
      localStorage.setItem(COOKIE_STORAGE_KEY, cookie)
      return { success: true }
    }
    return { success: false, error: result.error }
  }, [doLogin])

  const logout = useCallback(() => {
    setMember(null)
    localStorage.removeItem(COOKIE_STORAGE_KEY)
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
