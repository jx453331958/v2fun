import type { PullStatus } from '../hooks/usePullToRefresh'
import styles from './PullToRefreshIndicator.module.css'

interface Props {
  pullDistance: number
  status: PullStatus
}

const THRESHOLD = 60
const RING_RADIUS = 9
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

const STATUS_TEXT: Record<PullStatus, string> = {
  idle: '',
  pulling: '下拉刷新',
  ready: '松手刷新',
  refreshing: '刷新中...',
  success: '已更新',
  error: '刷新失败',
}

export default function PullToRefreshIndicator({ pullDistance, status }: Props) {
  if (status === 'idle') return null

  const progress = Math.min(pullDistance / THRESHOLD, 1)
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress)

  return (
    <div
      className={styles.container}
      style={{
        height: pullDistance,
        transition: status === 'pulling' ? 'none' : 'height 0.3s cubic-bezier(0.2, 0, 0, 1)',
      }}
    >
      <div className={`${styles.inner} ${styles[status]}`}>
        <div className={styles.icon}>
          {/* Pulling / Ready: progress ring */}
          {(status === 'pulling' || status === 'ready') && (
            <svg width="24" height="24" viewBox="0 0 24 24" className={styles.ring}>
              <circle
                cx="12" cy="12" r={RING_RADIUS}
                fill="none"
                stroke="var(--border)"
                strokeWidth="2"
              />
              <circle
                cx="12" cy="12" r={RING_RADIUS}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 12 12)"
                style={{ transition: 'stroke-dashoffset 0.05s linear' }}
              />
              {status === 'ready' && (
                <polyline
                  points="8,12.5 11,15.5 16,9.5"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={styles.readyCheck}
                />
              )}
              {status === 'pulling' && (
                <g transform="translate(12,12)">
                  <line
                    x1="0" y1="3" x2="0" y2="-2"
                    stroke="var(--text-tertiary)"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    style={{
                      opacity: progress,
                      transform: `scaleY(${0.5 + progress * 0.5})`,
                      transformOrigin: 'center',
                    }}
                  />
                  <polyline
                    points="-2.5,-0.5 0,-3 2.5,-0.5"
                    fill="none"
                    stroke="var(--text-tertiary)"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ opacity: progress }}
                  />
                </g>
              )}
            </svg>
          )}

          {/* Refreshing: spinning ring */}
          {status === 'refreshing' && (
            <svg width="24" height="24" viewBox="0 0 24 24" className={styles.spinRing}>
              <circle
                cx="12" cy="12" r={RING_RADIUS}
                fill="none"
                stroke="var(--border)"
                strokeWidth="2"
              />
              <circle
                cx="12" cy="12" r={RING_RADIUS}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={RING_CIRCUMFERENCE * 0.65}
                transform="rotate(-90 12 12)"
              />
            </svg>
          )}

          {/* Success: animated checkmark */}
          {status === 'success' && (
            <div className={styles.successIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24">
                <circle
                  cx="12" cy="12" r={RING_RADIUS}
                  fill="none"
                  stroke="var(--success)"
                  strokeWidth="2"
                  className={styles.successRing}
                />
                <polyline
                  points="8,12.5 11,15.5 16,9.5"
                  fill="none"
                  stroke="var(--success)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={styles.successCheck}
                />
              </svg>
            </div>
          )}

          {/* Error: X mark */}
          {status === 'error' && (
            <div className={styles.errorIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24">
                <circle
                  cx="12" cy="12" r={RING_RADIUS}
                  fill="none"
                  stroke="var(--danger)"
                  strokeWidth="2"
                />
                <line x1="9.5" y1="9.5" x2="14.5" y2="14.5" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" />
                <line x1="14.5" y1="9.5" x2="9.5" y2="14.5" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
          )}
        </div>

        <span className={styles.text}>{STATUS_TEXT[status]}</span>
      </div>
    </div>
  )
}
