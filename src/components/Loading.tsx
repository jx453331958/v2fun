import styles from './Loading.module.css'

export default function Loading({ text = '加载中...' }: { text?: string }) {
  return (
    <div className={styles.container}>
      <div className={styles.spinner}>
        <div className={styles.dot} />
        <div className={styles.dot} />
        <div className={styles.dot} />
      </div>
      <p className={styles.text}>{text}</p>
    </div>
  )
}

export function TopicSkeleton() {
  return (
    <div className={styles.skeleton}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className={styles.skeletonCard}>
          <div className={styles.skeletonHeader}>
            <div className={`skeleton ${styles.skeletonAvatar}`} />
            <div className={styles.skeletonMeta}>
              <div className={`skeleton ${styles.skeletonName}`} />
              <div className={`skeleton ${styles.skeletonTime}`} />
            </div>
          </div>
          <div className={`skeleton ${styles.skeletonTitle}`} />
          <div className={`skeleton ${styles.skeletonTitle2}`} />
        </div>
      ))}
    </div>
  )
}
