import type { PullStatus } from '../hooks/usePullToRefresh'
import styles from './PullToRefreshIndicator.module.css'

interface Props {
  pullDistance: number
  status: PullStatus
}

const THRESHOLD = 60
const SIZE = 26
const STROKE = 2.5
const R = (SIZE - STROKE) / 2
const C = 2 * Math.PI * R

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
            : 'height 0.4s cubic-bezier(0.33, 1, 0.68, 1)',
      }}
    >
      <div
        className={`${styles.spinner} ${isSpinning ? styles.spinning : ''}`}
        style={{
          opacity: isDone ? 0 : Math.min(progress * 1.5, 1),
          transform: isSpinning
            ? undefined
            : `scale(${0.5 + progress * 0.5}) rotate(${pullDistance * 2}deg)`,
          transition: isDone ? 'opacity 0.3s ease-out' : undefined,
        }}
      >
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {/* Background ring */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="var(--border)"
            strokeWidth={STROKE}
          />
          {/* Foreground arc with glow */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={isSpinning ? C * 0.7 : C * (1 - progress)}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            className={styles.arc}
          />
        </svg>
      </div>
    </div>
  )
}
