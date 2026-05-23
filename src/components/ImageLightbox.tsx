import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import styles from './ImageLightbox.module.css'

interface Props {
  images: string[]
  currentIndex: number
  sourceRect: DOMRect | null
  onClose: () => void
  onChange: (index: number) => void
}

type Phase = 'entering' | 'open' | 'closing'

function buildHeroTransform(sourceRect: DOMRect, imgEl: HTMLImageElement): string | undefined {
  const w = imgEl.offsetWidth
  if (!w) return undefined
  const vw = window.innerWidth
  const vh = window.innerHeight
  const scale = sourceRect.width / w
  const tx = sourceRect.left + sourceRect.width / 2 - vw / 2
  const ty = sourceRect.top + sourceRect.height / 2 - vh / 2
  return `translate(${tx}px, ${ty}px) scale(${scale})`
}

export default function ImageLightbox({ images, currentIndex, sourceRect, onClose, onChange }: Props) {
  const [phase, setPhase] = useState<Phase>('entering')
  const [heroTransform, setHeroTransform] = useState<string | undefined>()
  const isClosingRef = useRef(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

  const prev = useCallback(() => {
    if (isClosingRef.current) return
    onChange((currentIndex - 1 + images.length) % images.length)
  }, [currentIndex, images.length, onChange])

  const next = useCallback(() => {
    if (isClosingRef.current) return
    onChange((currentIndex + 1) % images.length)
  }, [currentIndex, images.length, onChange])

  const close = useCallback(() => {
    if (isClosingRef.current) return
    // Recalculate at close time — image is definitely loaded by now
    if (sourceRect && imgRef.current) {
      setHeroTransform(buildHeroTransform(sourceRect, imgRef.current))
    }
    isClosingRef.current = true
    setPhase('closing')
    setTimeout(() => onClose(), 340)
  }, [onClose, sourceRect])

  // On mount: calculate hero transform (works for cached images sized immediately)
  // and schedule open transition.
  useLayoutEffect(() => {
    if (sourceRect && imgRef.current) {
      setHeroTransform(buildHeroTransform(sourceRect, imgRef.current))
    }
    let raf2: number
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setPhase('open'))
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [close, prev, next])

  useEffect(() => {
    const saved = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = saved }
  }, [])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) next()
      else prev()
    } else if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
      const target = e.changedTouches[0].target as Element
      if (!target.closest('img') && !target.closest('button')) {
        e.preventDefault()
        close()
      }
    }
  }

  const imageStyle = (phase === 'entering' || phase === 'closing') && heroTransform
    ? { transform: heroTransform }
    : undefined

  return (
    <div
      className={styles.overlay}
      data-phase={phase}
      onClick={e => { if (e.target === e.currentTarget) close() }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        className={styles.closeBtn}
        onClick={e => { e.stopPropagation(); close() }}
        aria-label="关闭"
      >
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
        ref={imgRef}
        className={styles.image}
        src={images[currentIndex]}
        alt={`图片 ${currentIndex + 1}`}
        data-phase={phase}
        style={imageStyle}
        onClick={e => e.stopPropagation()}
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
        <div className={styles.counter} data-phase={phase}>
          {currentIndex + 1} / {images.length}
        </div>
      )}
    </div>
  )
}
