import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { web, type SovHit } from '../api/client'
import { useInfiniteScroll } from '../hooks/useInfiniteScroll'
import styles from './Search.module.css'

type Sort = 'sumup' | 'created'
const PAGE_SIZE = 20

// SOV2EX returns excerpts with <em>...</em> wrapping matches. Split on the
// tag and render alternating plain/highlighted spans — JSX escapes text
// content so any other HTML in the excerpt is rendered literally (safe).
function Highlight({ text }: { text: string }) {
  const parts = text.split(/<em>(.*?)<\/em>/g)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <mark key={i} className={styles.hit}>{part}</mark> : <span key={i}>{part}</span>
      )}
    </>
  )
}

// SOV2EX `created` is a naïve ISO string (no zone) — V2EX serves it as UTC.
// Append Z so Date.parse treats it as UTC instead of local time.
function parseSovTime(iso: string): Date {
  return new Date(/Z$/.test(iso) ? iso : iso + 'Z')
}

export default function Search() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQ = searchParams.get('q') ?? ''
  const initialSort = (searchParams.get('sort') as Sort) || 'sumup'

  const [input, setInput] = useState(initialQ)
  const [submitted, setSubmitted] = useState(initialQ)
  const [sort, setSort] = useState<Sort>(initialSort)
  const [total, setTotal] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Autofocus the input on mount so the keyboard pops on mobile immediately.
    inputRef.current?.focus()
  }, [])

  const fetchPage = useCallback(async (page: number) => {
    const from = (page - 1) * PAGE_SIZE
    const res = await web.searchTopics({ q: submitted, from, size: PAGE_SIZE, sort })
    if (!res.success) throw new Error(res.message || '搜索失败')
    if (page === 1) setTotal(res.total)
    return {
      items: res.hits,
      // SOV2EX exposes total — use it instead of length-based heuristics.
      hasMore: from + res.hits.length < res.total,
    }
  }, [submitted, sort])

  const { items, isInitialLoading, isLoading, isExhausted, error, sentinelRef, retry } =
    useInfiniteScroll<SovHit>({
      fetchPage,
      resetKey: submitted ? `${submitted}|${sort}` : '',
      getItemKey: (hit) => hit._id,
    })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = input.trim()
    if (!q || q === submitted) return
    setSubmitted(q)
    setTotal(null)
    setSearchParams({ q, sort }, { replace: false })
  }

  const handleSortChange = (next: Sort) => {
    if (next === sort) return
    setSort(next)
    if (submitted) {
      setTotal(null)
      setSearchParams({ q: submitted, sort: next }, { replace: true })
    }
  }

  const handleClear = () => {
    setInput('')
    inputRef.current?.focus()
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)} aria-label="返回">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <form className={styles.searchBox} onSubmit={handleSubmit}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.5" y2="16.5" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            className={styles.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="搜索主题"
            enterKeyHint="search"
            maxLength={100}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {input && (
            <button type="button" className={styles.clearBtn} onClick={handleClear} aria-label="清空">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </form>
      </header>

      {submitted && (
        <div className={styles.toolbar}>
          <div className={styles.sortTabs}>
            <button
              className={`${styles.sortTab} ${sort === 'sumup' ? styles.sortActive : ''}`}
              onClick={() => handleSortChange('sumup')}
            >
              相关度
            </button>
            <button
              className={`${styles.sortTab} ${sort === 'created' ? styles.sortActive : ''}`}
              onClick={() => handleSortChange('created')}
            >
              最新
            </button>
          </div>
          {total !== null && (
            <span className={styles.totalHint}>共 {total} 条</span>
          )}
        </div>
      )}

      {!submitted ? (
        <div className={styles.empty}>
          <p>输入关键词搜索 V2EX 主题</p>
          <p className={styles.emptyHint}>由 SOV2EX 提供索引</p>
        </div>
      ) : isInitialLoading ? (
        <div className={styles.empty}>搜索中…</div>
      ) : error && items.length === 0 ? (
        <div className={styles.errorBox}>
          <p>{error}</p>
          <button className={styles.retryBtn} onClick={retry}>重试</button>
        </div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>没有找到相关主题</div>
      ) : (
        <ul className={styles.list}>
          {items.map((hit) => {
            const src = hit._source
            const titleHtml = hit.highlight?.title?.[0] ?? src.title
            const contentHtml = hit.highlight?.content?.[0]
              ?? hit.highlight?.['postscript_list.content']?.[0]
              ?? hit.highlight?.['reply_list.content']?.[0]
              ?? (src.content || '').slice(0, 140)
            const timeAgo = formatDistanceToNow(parseSovTime(src.created), { locale: zhCN, addSuffix: true })
            return (
              <li
                key={hit._id}
                className={styles.item}
                onClick={() => navigate(`/topic/${src.id}`)}
              >
                <h3 className={styles.title}><Highlight text={titleHtml} /></h3>
                <p className={styles.excerpt}><Highlight text={contentHtml} /></p>
                <div className={styles.meta}>
                  <span className={styles.member}>{src.member}</span>
                  <span className={styles.dot} />
                  <span className={styles.time}>{timeAgo}</span>
                  {src.replies > 0 && (
                    <>
                      <span className={styles.dot} />
                      <span className={styles.replies}>{src.replies} 回复</span>
                    </>
                  )}
                </div>
              </li>
            )
          })}
          <li ref={sentinelRef as React.Ref<HTMLLIElement>} className={styles.sentinel}>
            {isLoading && !isInitialLoading && '加载中…'}
            {isExhausted && items.length > 0 && '没有更多了'}
            {error && !isLoading && (
              <button className={styles.retryBtn} onClick={retry}>重试</button>
            )}
          </li>
        </ul>
      )}
    </div>
  )
}
