import styles from './PullToRefreshIndicator.module.css'

interface Props {
  pullDistance: number
  isRefreshing: boolean
}

const THRESHOLD = 60

export default function PullToRefreshIndicator({ pullDistance, isRefreshing }: Props) {
  if (pullDistance <= 0 && !isRefreshing) return null

  const progress = Math.min(pullDistance / THRESHOLD, 1)
  const rotation = pullDistance * 3

  return (
    <div
      className={styles.container}
      style={{ height: pullDistance, transition: isRefreshing ? 'height 0.3s ease' : undefined }}
    >
      <div className={styles.indicator}>
        {isRefreshing ? (
          <div className={styles.spinner} />
        ) : (
          <svg
            className={styles.arrow}
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: `rotate(${rotation}deg)`,
              opacity: progress,
            }}
          >
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
        )}
      </div>
    </div>
  )
}
