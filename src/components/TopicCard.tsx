import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import type { V2Topic } from '../types'
import { useBlockedNodes } from '../hooks/useBlockedNodes'
import ConfirmDialog from './ConfirmDialog'
import styles from './TopicCard.module.css'

const LONG_PRESS_MS = 500

interface Props {
  topic: V2Topic
  index?: number
  /** When provided, called instead of navigating to /topic/:id (e.g. desktop master-detail). */
  onSelect?: (topicId: number) => void
  /** Visually mark this card as currently selected in the detail pane. */
  selected?: boolean
}

export default function TopicCard({ topic, onSelect, selected }: Props) {
  const navigate = useNavigate()
  const { blockNode } = useBlockedNodes()
  const timeAgo = formatDistanceToNow(new Date(topic.created * 1000), {
    locale: zhCN,
    addSuffix: true,
  })

  const handleClick = () => {
    if (onSelect) {
      onSelect(topic.id)
    } else {
      navigate(`/topic/${topic.id}`)
    }
  }

  // Long-press on the node badge → confirm block. Tap (short press) still
  // navigates to the node page. touchmove cancels so a scroll gesture that
  // happens to start on the badge isn't misread as a long-press.
  const longPressTimer = useRef<number | null>(null)
  const longPressFired = useRef(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const promptBlock = () => {
    if (!topic.node) return
    setConfirmOpen(true)
  }

  const handleConfirmBlock = () => {
    if (topic.node) blockNode(topic.node.name)
    setConfirmOpen(false)
  }

  const clearLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const handleNodeTouchStart = () => {
    longPressFired.current = false
    clearLongPress()
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true
      promptBlock()
    }, LONG_PRESS_MS)
  }

  const handleNodeTouchEnd = () => clearLongPress()

  const handleNodeClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    // Suppress the click that fires after a long-press completes on touch devices.
    if (longPressFired.current) {
      longPressFired.current = false
      return
    }
    navigate(`/node/${topic.node.name}`)
  }

  const handleNodeContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    promptBlock()
  }

  return (
    <>
    <article
      className={`${styles.card} ${selected ? styles.selected : ''}`}
      onClick={handleClick}
    >
      <div className={styles.meta}>
        {topic.member && (
          <div
            className={styles.avatar}
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/member/${topic.member.username}`)
            }}
          >
            <img
              src={topic.member.avatar_normal || topic.member.avatar}
              alt={topic.member.username}
              loading="lazy"
            />
          </div>
        )}
        <div className={styles.info}>
          {topic.member && (
            <span
              className={styles.username}
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/member/${topic.member.username}`)
              }}
            >
              {topic.member.username}
            </span>
          )}
          <div className={styles.details}>
            <span className={styles.time}>{timeAgo}</span>
            {topic.node && (
              <>
                <span className={styles.dot} />
                <span
                  className={styles.node}
                  onClick={handleNodeClick}
                  onContextMenu={handleNodeContextMenu}
                  onTouchStart={handleNodeTouchStart}
                  onTouchEnd={handleNodeTouchEnd}
                  onTouchMove={handleNodeTouchEnd}
                  onTouchCancel={handleNodeTouchEnd}
                >
                  {topic.node.title}
                </span>
              </>
            )}
          </div>
        </div>
        {topic.replies > 0 && (
          <div className={styles.replies}>
            <span>{topic.replies}</span>
          </div>
        )}
      </div>
      <h3 className={styles.title}>{topic.title}</h3>
    </article>
    {topic.node && (
      <ConfirmDialog
        open={confirmOpen}
        title={`屏蔽节点「${topic.node.title}」?`}
        message="以后该节点的主题不再出现在列表，可在「我的 → 已屏蔽节点」恢复"
        confirmText="屏蔽"
        cancelText="取消"
        onConfirm={handleConfirmBlock}
        onCancel={() => setConfirmOpen(false)}
        variant="block"
      />
    )}
    </>
  )
}
