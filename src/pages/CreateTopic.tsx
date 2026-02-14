import { getNewTopicWebUrl } from '../api/client'
import Header from '../components/Header'
import styles from './CreateTopic.module.css'

export default function CreateTopic() {
  const openV2EX = () => {
    window.open(getNewTopicWebUrl(), '_blank')
  }

  return (
    <div className={styles.page}>
      <Header title="发布主题" showBack />

      <div className={styles.guide}>
        <div className={styles.guideIcon}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </div>
        <p className={styles.guideText}>
          发布主题需要在 V2EX 网页端完成
        </p>
        <button className={styles.guideBtn} onClick={openV2EX}>
          前往 V2EX 发布
        </button>
      </div>
    </div>
  )
}
