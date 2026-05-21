import { useEffect } from 'react'

const SVG_NS = 'http://www.w3.org/2000/svg'

function svgEl(name: string, attrs: Record<string, string>): SVGElement {
  const el = document.createElementNS(SVG_NS, name)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  return el
}

function makeCopyIcon(): SVGSVGElement {
  const svg = svgEl('svg', {
    width: '14',
    height: '14',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.8',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  }) as SVGSVGElement
  svg.appendChild(svgEl('rect', { x: '9', y: '9', width: '13', height: '13', rx: '2', ry: '2' }))
  svg.appendChild(
    svgEl('path', { d: 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' })
  )
  return svg
}

function makeCheckIcon(): SVGSVGElement {
  const svg = svgEl('svg', {
    width: '14',
    height: '14',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  }) as SVGSVGElement
  svg.appendChild(svgEl('polyline', { points: '20 6 9 17 4 12' }))
  return svg
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to execCommand
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/**
 * Inject a one-click copy button into every <pre> inside `ref`.
 *
 * Re-runs whenever any value in `deps` changes (typically the rendered HTML
 * string). The injected button is created via DOM APIs (no innerHTML) and
 * lives in the real DOM after DOMPurify has already sanitised the content —
 * we don't need to extend the sanitiser allowlist. A single delegated click
 * listener on the container handles all buttons; each click only copies the
 * text of its own <pre>.
 */
export function useCodeBlockCopy(
  ref: React.RefObject<HTMLElement | null>,
  deps: unknown[] = []
) {
  useEffect(() => {
    const root = ref.current
    if (!root) return

    const pres = root.querySelectorAll('pre')
    pres.forEach(pre => {
      if (pre.querySelector('[data-code-copy]')) return
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'code-copy-btn'
      btn.setAttribute('data-code-copy', '')
      btn.setAttribute('aria-label', '复制代码')
      btn.title = '复制代码'
      btn.appendChild(makeCopyIcon())
      pre.appendChild(btn)
    })

    const onClick = async (e: Event) => {
      const target = e.target as HTMLElement | null
      const btn = target?.closest<HTMLButtonElement>('[data-code-copy]')
      if (!btn || !root.contains(btn)) return
      e.preventDefault()
      e.stopPropagation()
      const pre = btn.closest('pre')
      if (!pre) return
      const code = pre.querySelector('code')
      const text = (code?.textContent ?? pre.textContent ?? '').replace(/\n$/, '')
      const ok = await copyText(text)
      if (!ok) return
      btn.setAttribute('data-copied', '1')
      btn.replaceChildren(makeCheckIcon())
      window.setTimeout(() => {
        btn.removeAttribute('data-copied')
        btn.replaceChildren(makeCopyIcon())
      }, 1500)
    }

    root.addEventListener('click', onClick)
    return () => root.removeEventListener('click', onClick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
