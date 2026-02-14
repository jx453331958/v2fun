import { useNavigate } from 'react-router-dom'
import styles from './Header.module.css'

interface Props {
  title: string
  showBack?: boolean
  right?: React.ReactNode
}

export default function Header({ title, showBack = false, right }: Props) {
  const navigate = useNavigate()

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        {showBack && (
          <button className={styles.backBtn} onClick={() => navigate(-1)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}
      </div>
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.right}>{right}</div>
    </header>
  )
}
