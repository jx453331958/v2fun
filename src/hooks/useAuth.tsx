import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { v2, web } from '../api/client'
import type { V2Member } from '../types'

interface AuthState {
  token: string | null
  member: V2Member | null
  loading: boolean
  login: (token: string) => Promise<boolean>
  logout: () => void
  isLoggedIn: boolean
  hasCookie: boolean
  saveCookie: (cookie: string) => Promise<boolean>
  clearCookie: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

/** Persist token to server (encrypted) so it survives redeployment */
function saveTokenToServer(token: string) {
  fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  }).catch(() => {})
}

function clearTokenFromServer() {
  fetch('/auth/logout', { method: 'POST' }).catch(() => {})
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('v2fun_token'))
  const [member, setMember] = useState<V2Member | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasCookie, setHasCookie] = useState(false)

  // Restore token from server if localStorage is empty (e.g. after redeployment / new browser)
  useEffect(() => {
    if (localStorage.getItem('v2fun_token')) {
      // Still check cookie status
      web.getCookieStatus().then(d => setHasCookie(d.hasCookie)).catch(() => {})
      return
    }

    fetch('/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.token) {
          localStorage.setItem('v2fun_token', data.token)
          setToken(data.token)
          web.getCookieStatus().then(d => setHasCookie(d.hasCookie)).catch(() => {})
        } else {
          setLoading(false)
        }
      })
      .catch(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchMember = useCallback(async () => {
    try {
      setLoading(true)
      const res = await v2.member()
      if (res.success) {
        setMember(res.result)
        // Re-establish server session so cookie endpoints work
        // (session may be stale after server restart)
        const t = localStorage.getItem('v2fun_token')
        if (t) saveTokenToServer(t)
      }
    } catch {
      localStorage.removeItem('v2fun_token')
      setToken(null)
      setMember(null)
      clearTokenFromServer()
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
        saveTokenToServer(newToken)
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

  const saveCookie = async (cookie: string) => {
    try {
      const res = await web.saveCookie(cookie)
      if (res.success) {
        setHasCookie(true)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  const clearCookie = async () => {
    try {
      await web.clearCookie()
    } catch { /* ignore */ }
    setHasCookie(false)
  }

  const logout = () => {
    localStorage.removeItem('v2fun_token')
    setToken(null)
    setMember(null)
    setHasCookie(false)
    clearTokenFromServer()
  }

  return (
    <AuthContext.Provider value={{ token, member, loading, login, logout, isLoggedIn: !!member, hasCookie, saveCookie, clearCookie }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
