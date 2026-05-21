import type { ReactNode } from 'react'
import { useTheme, ACCENTS, type AccentSlug, type ThemeMode } from '../hooks/useTheme'
import styles from './ThemeSettings.module.css'

/**
 * Renders the appearance controls *without* an outer card. The parent
 * (currently Profile's "外观" section) supplies the section title + chrome.
 */
export default function ThemeSettings() {
  const { theme, accent, setTheme, setAccent } = useTheme()
  const currentName = ACCENTS.find(a => a.slug === accent)?.name ?? ''

  return (
    <div className={styles.rows}>
      <div className={styles.row}>
        <span className={styles.rowLabel}>显示模式</span>
        <div className={styles.modeToggle} role="group" aria-label="显示模式">
          <ModeBtn current={theme} value="dark" onClick={setTheme}>
            <MoonIcon /> 暗色
          </ModeBtn>
          <ModeBtn current={theme} value="light" onClick={setTheme}>
            <SunIcon /> 明亮
          </ModeBtn>
        </div>
      </div>

      <div className={styles.row}>
        <span className={styles.rowLabel}>
          主题色 · <span className={styles.accentName}>{currentName}</span>
        </span>
        <div className={styles.accentRow} role="radiogroup" aria-label="主题色">
          {ACCENTS.map(({ slug, name, color }) => (
            <button
              key={slug}
              type="button"
              role="radio"
              aria-checked={accent === slug}
              aria-label={name}
              className={styles.swatch}
              data-active={accent === slug}
              style={{ background: color, color }}
              onClick={() => setAccent(slug as AccentSlug)}
            >
              {accent === slug && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ModeBtn({ current, value, onClick, children }: {
  current: ThemeMode
  value: ThemeMode
  onClick: (v: ThemeMode) => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={styles.modeBtn}
      data-active={current === value}
      aria-pressed={current === value}
      onClick={() => onClick(value)}
    >
      {children}
    </button>
  )
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}
