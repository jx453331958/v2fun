import styles from './Pagination.module.css'

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const pages: (number | 'ellipsis')[] = [1]

  if (current > 4) {
    pages.push('ellipsis')
  }

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  if (current < total - 3) {
    pages.push('ellipsis')
  }

  if (total > 1) {
    pages.push(total)
  }

  return pages
}

export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  const pages = getPageNumbers(page, totalPages)

  return (
    <nav className={styles.pagination}>
      <button
        className={styles.btn}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="上一页"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {pages.map((item, idx) =>
        item === 'ellipsis' ? (
          <span key={`e-${idx}`} className={styles.ellipsis}>...</span>
        ) : (
          <button
            key={item}
            className={`${styles.btn} ${item === page ? styles.active : ''}`}
            onClick={() => onPageChange(item)}
          >
            {item}
          </button>
        )
      )}

      <button
        className={styles.btn}
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label="下一页"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </nav>
  )
}
