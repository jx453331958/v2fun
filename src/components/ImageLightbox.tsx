import { useEffect, useRef, useCallback } from 'react'
import styles from './ImageLightbox.module.css'

interface Props {
  images: string[]
  currentIndex: number
  onClose: () => void
  onChange: (index: number) => void
}

export default function ImageLightbox({ images, currentIndex, onClose, onChange }: Props) {
  const touchStartX = useRef(0)

  const prev = useCallback(() => {
    onChange((currentIndex - 1 + images.length) % images.length)
  }, [currentIndex, images.length, onChange])

  const next = useCallback(() => {
    onChange((currentIndex + 1) % images.length)
  }, [currentIndex, images.length, onChange])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose, prev, next])

  useEffect(() => {
    const saved = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = saved }
  }, [])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 50) {
      if (dx < 0) next()
      else prev()
    }
  }

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button className={styles.closeBtn} onClick={onClose} aria-label="关闭">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {images.length > 1 && (
        <button
          className={`${styles.navBtn} ${styles.prevBtn}`}
          onClick={e => { e.stopPropagation(); prev() }}
          aria-label="上一张"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}

      <img
        className={styles.image}
        src={images[currentIndex]}
        alt={`图片 ${currentIndex + 1}`}
        onClick={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
        onTouchEnd={e => e.stopPropagation()}
      />

      {images.length > 1 && (
        <button
          className={`${styles.navBtn} ${styles.nextBtn}`}
          onClick={e => { e.stopPropagation(); next() }}
          aria-label="下一张"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}

      {images.length > 1 && (
        <div className={styles.counter}>{currentIndex + 1} / {images.length}</div>
      )}
    </div>
  )
}
