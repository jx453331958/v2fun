import type { PullStatus } from '../hooks/usePullToRefresh'
import styles from './PullToRefreshIndicator.module.css'

interface Props {
  pullDistance: number
  status: PullStatus
}

const THRESHOLD = 60
const SEGMENTS = 8
const SPIN_DURATION = 0.8

export default function PullToRefreshIndicator({ pullDistance, status }: Props) {
  if (status === 'idle') return null

  const progress = Math.min(pullDistance / THRESHOLD, 1)
  const isSpinning = status === 'refreshing'
  const isDone = status === 'success' || status === 'error'

  return (
    <div
      className={styles.container}
      style={{
        height: pullDistance,
        transition:
          status === 'pulling' || status === 'ready'
            ? 'none'
            : 'height 0.45s cubic-bezier(0.32, 0.72, 0, 1)',
      }}
    >
      <div
        className={styles.spinnerWrap}
        style={{
          opacity: isDone ? 0 : progress,
          transform: isSpinning
            ? undefined
            : `scale(${0.5 + progress * 0.5}) rotate(${pullDistance * 3}deg)`,
          transition: isDone ? 'opacity 0.3s ease-out' : undefined,
        }}
      >
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <div
            key={i}
            className={`${styles.petal} ${isSpinning ? styles.petalSpin : ''}`}
            style={{
              transform: `rotate(${i * (360 / SEGMENTS)}deg)`,
              opacity: isSpinning ? undefined : 1 - (i / SEGMENTS) * 0.75,
              animationDelay: isSpinning
                ? `${(-i * SPIN_DURATION) / SEGMENTS}s`
                : undefined,
            }}
          />
        ))}
      </div>
    </div>
  )
}
