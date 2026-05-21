import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import Profile from '../pages/Profile'
import styles from './ProfileModal.module.css'

/**
 * Desktop overlay for the Profile page. Rendered by App.tsx when the location
 * carries a `state.background` (or on a /profile direct-load with isDesktop,
 * App fakes one). The actual route stays /profile so refresh and deep-linking
 * still work; behind the modal, the routed background page (usually Home)
 * keeps rendering inside <Routes location={background} />.
 */
export default function ProfileModal() {
  const navigate = useNavigate()

  const close = () => {
    // navigate(-1) returns to whatever the user came from (Home, Notifications, …).
    // On a /profile direct-load with no real history entry behind, fall back to "/".
    if (window.history.state && (window.history.state.idx ?? 0) > 0) {
      navigate(-1)
    } else {
      navigate('/', { replace: true })
    }
  }

  // ESC key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // close is a stable closure for the lifetime of the mounted modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Body scroll lock while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return createPortal(
    <div className={styles.backdrop} onClick={close}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>我的</h2>
          <button className={styles.closeBtn} onClick={close} aria-label="关闭">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className={styles.modalBody}>
          <Profile inModal />
        </div>
      </div>
    </div>,
    document.body
  )
}
