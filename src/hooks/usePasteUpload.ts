import { useCallback, useEffect, useRef } from 'react'
import { web } from '../api/client'

const CAPABILITY_KEY = 'v2fun:upload-capability'
const DEFAULT_MAX_SIZE = 10 * 1024 * 1024
const DEFAULT_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

interface Capability {
  enabled: boolean
  maxSizeBytes: number
  mimes: string[]
}

let capabilityPromise: Promise<Capability> | null = null

async function loadCapability(): Promise<Capability> {
  // sessionStorage 缓存：避免每次 paste 都探一次
  const cached = sessionStorage.getItem(CAPABILITY_KEY)
  if (cached) {
    try { return JSON.parse(cached) as Capability } catch { /* fall through */ }
  }
  if (!capabilityPromise) {
    capabilityPromise = web.uploadCapability().then(r => {
      const cap: Capability = {
        enabled: r.enabled,
        maxSizeBytes: r.maxSizeBytes ?? DEFAULT_MAX_SIZE,
        mimes: r.mimes ?? DEFAULT_MIMES,
      }
      sessionStorage.setItem(CAPABILITY_KEY, JSON.stringify(cap))
      return cap
    }).catch(() => ({ enabled: false, maxSizeBytes: DEFAULT_MAX_SIZE, mimes: DEFAULT_MIMES }))
  }
  return capabilityPromise
}

function insertAtCursor(
  textarea: HTMLTextAreaElement,
  insertion: string,
  setValueRaw: (next: string) => void,
) {
  const before = textarea.value.slice(0, textarea.selectionStart)
  const after = textarea.value.slice(textarea.selectionEnd)
  const next = before + insertion + after
  setValueRaw(next)
  requestAnimationFrame(() => {
    const pos = before.length + insertion.length
    textarea.selectionStart = textarea.selectionEnd = pos
    textarea.focus()
  })
}

interface UsePasteUploadOptions {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  /** Functional setter for replacing markers without stale-state races. */
  setValue: (updater: (prev: string) => string) => void
  /** Imperative setter for the initial cursor insert. */
  setValueRaw: (next: string) => void
}

export function usePasteUpload({ textareaRef, setValue, setValueRaw }: UsePasteUploadOptions) {
  const setValueRef = useRef(setValue)
  const setValueRawRef = useRef(setValueRaw)
  useEffect(() => { setValueRef.current = setValue }, [setValue])
  useEffect(() => { setValueRawRef.current = setValueRaw }, [setValueRaw])

  const onPaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items
    if (!items) return
    let file: File | null = null
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      if (it.kind === 'file' && it.type.startsWith('image/')) {
        file = it.getAsFile()
        if (file) break
      }
    }
    if (!file) return

    e.preventDefault()
    const textarea = textareaRef.current
    if (!textarea) return

    const cap = await loadCapability()
    if (!cap.enabled) {
      // 服务端没启用图床：static no-op。我们已经 preventDefault 了，浏览器
      // 原生粘贴也不会触发，用户看到的就是"什么都没发生"。
      return
    }

    if (!cap.mimes.includes(file.type)) {
      flashTransient(textarea, setValueRawRef.current, setValueRef.current, '[不支持的图片格式]')
      return
    }
    if (file.size > cap.maxSizeBytes) {
      const mb = Math.round(cap.maxSizeBytes / 1024 / 1024)
      flashTransient(textarea, setValueRawRef.current, setValueRef.current, `[图片太大，最大 ${mb}MB]`)
      return
    }

    const uniq = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const placeholder = `\n[上传中... ${uniq}]\n`
    insertAtCursor(textarea, placeholder, setValueRawRef.current)

    try {
      const res = await web.uploadImage(file)
      if (res.success && res.url) {
        const fullUrl = `${window.location.origin}${res.url}`
        // V2EX 只对白名单域名（imgur 等）的裸 URL 自动转图；我们用 ![](url)
        // 让 V2EX 主题（Markdown 模式）和未来的 v2fun 自渲染层都能识别为图。
        // 回复里 V2EX 不解析 Markdown，会显示为字面字符串——已是 V2EX 系统限制。
        replaceInValue(setValueRef.current, placeholder, `\n![](${fullUrl})\n`)
      } else {
        const msg = errorMessage(res.error)
        replaceInValue(setValueRef.current, placeholder, `\n${msg}\n`)
      }
    } catch {
      replaceInValue(setValueRef.current, placeholder, `\n[上传失败：网络错误]\n`)
    }
  }, [textareaRef])

  return { onPaste }
}

function replaceInValue(
  setValue: (updater: (prev: string) => string) => void,
  marker: string,
  replacement: string,
) {
  setValue(prev => prev.includes(marker) ? prev.replace(marker, replacement) : prev)
}

function errorMessage(code?: string): string {
  switch (code) {
    case 'file_too_large': return '[图片太大，最大 10MB]'
    case 'invalid_mime': return '[不支持的图片格式]'
    case 'rate_limited': return '[上传太快，请稍候]'
    case 'passcode_required': return '[上传失败：登录已过期]'
    case 'host_disabled': return '[上传失败：图床未启用]'
    case 'upstream_failed':
    default: return '[上传失败：图床暂不可用]'
  }
}

function flashTransient(
  textarea: HTMLTextAreaElement,
  setValueRaw: (next: string) => void,
  setValue: (updater: (prev: string) => string) => void,
  text: string,
) {
  const wrapped = `\n${text}\n`
  insertAtCursor(textarea, wrapped, setValueRaw)
  setTimeout(() => {
    setValue(prev => prev.includes(wrapped) ? prev.replace(wrapped, '') : prev)
  }, 1500)
}
