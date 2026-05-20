import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

export type ThemeMode = 'dark' | 'light'
export type AccentSlug = 'teal' | 'indigo' | 'sage' | 'coral' | 'plum' | 'amber' | 'neutral'

export const ACCENTS: ReadonlyArray<{ slug: AccentSlug; name: string; color: string }> = [
  { slug: 'teal', name: '雾松绿', color: '#5FA8A0' },
  { slug: 'indigo', name: '静蓝', color: '#7B8FD8' },
  { slug: 'sage', name: '鼠尾草', color: '#7CA982' },
  { slug: 'coral', name: '珊瑚橘', color: '#E89B6C' },
  { slug: 'plum', name: '梅子紫', color: '#B084CC' },
  { slug: 'amber', name: '蜜琥珀', color: '#D4A574' },
  { slug: 'neutral', name: '无彩', color: '#7E7E8C' },
]

const STORAGE_THEME = 'v2fun_theme'
const STORAGE_ACCENT = 'v2fun_accent'
const DEFAULT_THEME: ThemeMode = 'dark'
const DEFAULT_ACCENT: AccentSlug = 'teal'

function readTheme(): ThemeMode {
  try {
    const ls = localStorage.getItem(STORAGE_THEME)
    if (ls === 'dark' || ls === 'light') return ls
  } catch { /* private mode etc. */ }
  const attr = typeof document !== 'undefined'
    ? document.documentElement.getAttribute('data-theme')
    : null
  if (attr === 'dark' || attr === 'light') return attr
  return DEFAULT_THEME
}

function readAccent(): AccentSlug {
  try {
    const ls = localStorage.getItem(STORAGE_ACCENT)
    if (ls && ACCENTS.some(a => a.slug === ls)) return ls as AccentSlug
  } catch { /* ignore */ }
  const attr = typeof document !== 'undefined'
    ? document.documentElement.getAttribute('data-accent')
    : null
  if (attr && ACCENTS.some(a => a.slug === attr)) return attr as AccentSlug
  return DEFAULT_ACCENT
}

interface ThemeContextValue {
  theme: ThemeMode
  accent: AccentSlug
  setTheme: (t: ThemeMode) => void
  setAccent: (a: AccentSlug) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => readTheme())
  const [accent, setAccentState] = useState<AccentSlug>(() => readAccent())

  // 兜底:即使 inline script 因任何原因没跑(CSP 拒、CDN 干扰...),React mount 时
  // 把当前 state(来自 localStorage)同步到 DOM,确保 CSS 变量能生效。
  // 代价是首屏可能有半帧 FOUC,但状态正确。正常路径下 inline script 已经写过,这里是 no-op。
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.setAttribute('data-accent', accent)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setTheme = useCallback((t: ThemeMode) => {
    setThemeState(t)
    document.documentElement.setAttribute('data-theme', t)
    try { localStorage.setItem(STORAGE_THEME, t) } catch { /* private mode etc. */ }
  }, [])

  const setAccent = useCallback((a: AccentSlug) => {
    setAccentState(a)
    document.documentElement.setAttribute('data-accent', a)
    try { localStorage.setItem(STORAGE_ACCENT, a) } catch { /* ignore */ }
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, accent, setTheme, setAccent }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
