# 粘贴图片自动上传图床 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用户在发主题 / 回帖 textarea 里 `Cmd+V` 一张图，系统自动通过 Telegram Bot 上传图床、把 `https://v2fun.ohminicat.com/img/<file_id>` 单独成行插入到光标位置（V2EX 自动渲染为图片）。

**Architecture:** Frontend `usePasteUpload` hook 拦 paste、插占位符、调后端；Express 后端 `imageHost` 模块封装 TG Bot 的 `sendPhoto`/`getFile`，三个新路由分别管能力探测、上传和 file_id 转 302 跳转。token 永远不出后端。

**Tech Stack:** React 19 / TypeScript / Vite 6 前端；Express + multer 后端；Telegram Bot API。无新前端依赖；后端新增 `multer`。

**Spec:** `docs/superpowers/specs/2026-05-21-paste-image-upload-design.md`

**项目约定（影响 plan 结构）：**
- 仓库无单元测试基础设施；前端有 Playwright e2e，服务端约定"先在 dev server 跑通再提交"
- 所有 `/web/*` 路径已被 `verifyPasscodeCookie` 中间件全局保护，新增路由自动继承
- `/img/:fileId` 不能落在 `/web/*` 下，否则会被 passcode 拦截（图片是公开浏览的）
- 错误响应一律 HTTP 200 + `{success:false, error:"..."}`（Cloudflare 会改写 5xx 体，详见 `memory/project_error_response_shape.md`）

---

### Task 1: 后端新增 multer 依赖 + TG 配置探测

**Files:**
- Modify: `server/package.json`

- [ ] **Step 1: 安装 multer 到 server 子目录**

```bash
cd /Users/jiangxuan/Projects/v2fun/server && npm install multer@^1.4.5-lts.1
```

Expected: `server/package.json` 的 dependencies 里出现 `"multer": "^1.4.5-lts.1"`；`server/package-lock.json` 更新；`server/node_modules/multer` 存在。

- [ ] **Step 2: 检查 import 不报错**

```bash
cd /Users/jiangxuan/Projects/v2fun/server && node -e "import('multer').then(m => console.log('ok', typeof m.default))"
```

Expected: `ok function`

- [ ] **Step 3: Commit**

```bash
cd /Users/jiangxuan/Projects/v2fun && git add server/package.json server/package-lock.json && git commit -m "chore(server): add multer for multipart upload handling"
```

---

### Task 2: 写 `server/imageHost.mjs`（TG Bot driver）

**Files:**
- Create: `server/imageHost.mjs`

- [ ] **Step 1: 创建模块骨架，导出 `isEnabled`、`upload`、`resolve`**

完整文件内容（不要省略）：

```javascript
// Telegram Bot 图床 driver。封装 sendPhoto / getFile，对外暴露稳定 file_id 路径，
// token 永远不出此模块和 server/index.mjs。
//
// 启用条件：环境变量 TG_BOT_TOKEN + TG_CHAT_ID 同时存在。
// 缺任一项 → isEnabled() = false，调用 upload/resolve 会抛错。

const TOKEN = process.env.TG_BOT_TOKEN
const CHAT_ID = process.env.TG_CHAT_ID
const API_BASE = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : null
const FILE_BASE = TOKEN ? `https://api.telegram.org/file/bot${TOKEN}` : null

// file_id (永久) → { filePath, expiresAt }
// TG 的下载 URL 至少 1 小时有效，我们缓存 50 分钟留一点 buffer。
const fileCache = new Map()
const CACHE_TTL_MS = 50 * 60 * 1000

export function isEnabled() {
  return !!(TOKEN && CHAT_ID)
}

/**
 * 上传图片 Buffer 到 TG 频道，返回稳定的 file_id。
 * @param {Buffer} buffer
 * @param {string} mime 形如 "image/png"
 * @returns {Promise<string>} file_id
 */
export async function upload(buffer, mime) {
  if (!isEnabled()) throw new Error('image_host_disabled')

  // Telegram sendPhoto 接受 multipart/form-data，用 Node 18+ 内置 fetch + FormData + Blob
  const form = new FormData()
  form.append('chat_id', CHAT_ID)
  form.append('photo', new Blob([buffer], { type: mime }), filenameFor(mime))

  const res = await fetch(`${API_BASE}/sendPhoto`, { method: 'POST', body: form })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.ok) {
    const desc = json?.description || `HTTP ${res.status}`
    throw new Error(`tg_send_failed: ${desc}`)
  }
  // sendPhoto 响应 result.photo 是从小到大的多档缩略图，最后一项是最大尺寸
  const photos = json.result?.photo
  if (!Array.isArray(photos) || photos.length === 0) {
    throw new Error('tg_send_failed: no photo in response')
  }
  return photos[photos.length - 1].file_id
}

/**
 * 把 file_id 解析为真实下载 URL（带 token）。命中缓存直接返；否则 getFile 后写缓存。
 * @param {string} fileId
 * @returns {Promise<string>} 完整 download URL
 */
export async function resolve(fileId) {
  if (!isEnabled()) throw new Error('image_host_disabled')

  const cached = fileCache.get(fileId)
  if (cached && cached.expiresAt > Date.now()) {
    return `${FILE_BASE}/${cached.filePath}`
  }

  const url = `${API_BASE}/getFile?file_id=${encodeURIComponent(fileId)}`
  const res = await fetch(url)
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.ok) {
    throw new Error(`tg_getfile_failed: ${json?.description || res.status}`)
  }
  const filePath = json.result?.file_path
  if (!filePath) throw new Error('tg_getfile_failed: no file_path')

  fileCache.set(fileId, { filePath, expiresAt: Date.now() + CACHE_TTL_MS })
  return `${FILE_BASE}/${filePath}`
}

function filenameFor(mime) {
  const ext = ({
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
  })[mime] || 'bin'
  return `paste-${Date.now()}.${ext}`
}
```

- [ ] **Step 2: 烟测模块本身（不连 TG，只验语法）**

```bash
cd /Users/jiangxuan/Projects/v2fun/server && node -e "import('./imageHost.mjs').then(m => console.log('isEnabled =', m.isEnabled()))"
```

Expected: `isEnabled = false`（没设 env）

- [ ] **Step 3: Commit**

```bash
cd /Users/jiangxuan/Projects/v2fun && git add server/imageHost.mjs && git commit -m "feat(server): add Telegram Bot image host driver"
```

---

### Task 3: 后端加上传 / capability / 浏览三个路由

**Files:**
- Modify: `server/index.mjs`

- [ ] **Step 1: 在文件顶部 import 区加 multer 和 imageHost**

找到现有的 import 段（前 10 行），在 `import rateLimit from 'express-rate-limit'` 后插入：

```javascript
import multer from 'multer'
import * as imageHost from './imageHost.mjs'
```

- [ ] **Step 2: 在 `webWriteLimiter` 定义后（约 426 行）追加 upload 专用限频器和 multer 实例**

定位到：

```javascript
const webWriteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 20,
  ...
})
```

在其后追加：

```javascript
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'rate_limited' },
})

const ALLOWED_IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_MIMES.has(file.mimetype)) cb(null, true)
    else cb(null, false) // 不抛错，进 handler 后 req.file 会是 undefined
  },
})
```

- [ ] **Step 3: 加 capability 路由**

找到 `app.get('/web/hot', ...)` 那一行（约 864 行）。在它**之前**插入：

```javascript
app.get('/web/upload-capability', (_req, res) => {
  if (!imageHost.isEnabled()) {
    return res.json({ success: true, enabled: false })
  }
  res.json({
    success: true,
    enabled: true,
    maxSizeBytes: MAX_IMAGE_BYTES,
    mimes: Array.from(ALLOWED_IMAGE_MIMES),
  })
})
```

- [ ] **Step 4: 加 upload 路由**

在上一步插入的 capability 路由后追加：

```javascript
app.post('/web/upload-image', uploadLimiter, upload.single('file'), async (req, res) => {
  if (!imageHost.isEnabled()) {
    return res.json({ success: false, error: 'host_disabled' })
  }
  if (!req.file) {
    return res.json({ success: false, error: 'invalid_mime' })
  }
  try {
    const fileId = await imageHost.upload(req.file.buffer, req.file.mimetype)
    res.json({ success: true, url: `/img/${encodeURIComponent(fileId)}` })
  } catch (err) {
    console.error('[web/upload-image]', err.message)
    res.json({ success: false, error: 'upstream_failed' })
  }
})

// multer 限频错误处理（fileSize 超 → MulterError），仅作用于此路由
app.use('/web/upload-image', (err, _req, res, _next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.json({ success: false, error: 'file_too_large' })
  }
  return res.json({ success: false, error: 'upstream_failed' })
})
```

- [ ] **Step 5: 加 `/img/:fileId` 路由（必须放在 passcode 中间件之外）**

找到 `// Passcode protection middleware` 那段（约 337 行），在其**之前**插入：

```javascript
// 图片浏览代理：不需要 passcode（V2EX 帖子里的 <img> 加载会触发此路径，
// 任何浏览者都得能读）。token 通过 302 Location 头流向客户端 — 这是与
// "完全藏 token" 的取舍，详见 spec §2 决策表。
app.get('/img/:fileId', async (req, res) => {
  if (!imageHost.isEnabled()) return res.status(404).end()
  try {
    const downloadUrl = await imageHost.resolve(req.params.fileId)
    res.redirect(302, downloadUrl)
  } catch (err) {
    console.error('[img]', err.message)
    res.status(404).end()
  }
})
```

- [ ] **Step 6: 启动 server 验证三个路由可达（不连真 TG）**

```bash
cd /Users/jiangxuan/Projects/v2fun && node server/index.mjs &
sleep 1
echo "--- capability ---"
curl -s http://localhost:3210/web/upload-capability
echo ""
echo "--- img (host disabled) ---"
curl -si http://localhost:3210/img/anything | head -3
kill %1 2>/dev/null
wait 2>/dev/null
```

Expected:
- capability: `{"success":true,"enabled":false}` 注意：这条**应该**返 403 passcode_required 因为它在 /web/* 下，没带 cookie。**修正**：实际它会被 passcode 中间件挡，需要带 cookie 才能测。下面改测姿势：

```bash
# 拿到本地 passcode
PASSCODE=$(cat /Users/jiangxuan/Projects/v2fun/data/.passcode)
cd /Users/jiangxuan/Projects/v2fun && node server/index.mjs &
sleep 1
COOKIE=$(curl -si -X POST http://localhost:3210/auth/verify-passcode \
  -H "Content-Type: application/json" \
  -d "{\"passcode\":\"$PASSCODE\"}" | grep -i '^set-cookie:' | head -1 | sed 's/^[Ss]et-[Cc]ookie: //' | cut -d';' -f1)
echo "--- capability (with cookie) ---"
curl -s -H "Cookie: $COOKIE" http://localhost:3210/web/upload-capability
echo ""
echo "--- img (no cookie needed) ---"
curl -si http://localhost:3210/img/anything | head -3
kill %1 2>/dev/null
wait 2>/dev/null
```

Expected:
- capability: `{"success":true,"enabled":false}`
- img: `HTTP/1.1 404`（host 未启用）

- [ ] **Step 7: Commit**

```bash
cd /Users/jiangxuan/Projects/v2fun && git add server/index.mjs && git commit -m "feat(server): add /web/upload-image, /web/upload-capability, /img/:fileId routes"
```

---

### Task 4: 前端 client.ts 加两个 API 函数

**Files:**
- Modify: `src/api/client.ts`

- [ ] **Step 1: 在 `web` 对象内追加 `uploadImage` 和 `getUploadCapability`**

定位到 `web` 对象内最后一个方法 `searchTopics`（约 146 行）。在它**之前**追加（保留尾逗号一致性）：

```typescript
  uploadImage: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return fetch('/web/upload-image', {
      method: 'POST',
      credentials: 'same-origin',
      body: fd,
    }).then(readJsonOrFail) as Promise<{ success: boolean; url?: string; error?: string }>
  },

  uploadCapability: () =>
    fetch('/web/upload-capability', { credentials: 'same-origin' })
      .then(readJsonOrFail) as Promise<{ success: boolean; enabled: boolean; maxSizeBytes?: number; mimes?: string[] }>,
```

- [ ] **Step 2: TypeScript 编译通过**

```bash
cd /Users/jiangxuan/Projects/v2fun && npx tsc --noEmit
```

Expected: 无输出（无错误）

- [ ] **Step 3: Commit**

```bash
cd /Users/jiangxuan/Projects/v2fun && git add src/api/client.ts && git commit -m "feat(client): add uploadImage and uploadCapability APIs"
```

---

### Task 5: 创建 `usePasteUpload` hook

**Files:**
- Create: `src/hooks/usePasteUpload.ts`

- [ ] **Step 1: 写完整 hook**

完整文件内容：

```typescript
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

/**
 * Insert text at the textarea's cursor, update state via onChange, return the
 * exact substring that was inserted so it can later be located + replaced.
 */
function insertAtCursor(
  textarea: HTMLTextAreaElement,
  insertion: string,
  setValue: (next: string) => void,
): { marker: string } {
  const before = textarea.value.slice(0, textarea.selectionStart)
  const after = textarea.value.slice(textarea.selectionEnd)
  const next = before + insertion + after
  setValue(next)
  // defer cursor move to next tick so React's re-render lands first
  requestAnimationFrame(() => {
    const pos = before.length + insertion.length
    textarea.selectionStart = textarea.selectionEnd = pos
    textarea.focus()
  })
  return { marker: insertion }
}

/**
 * Replace the marker substring with replacement in the current value.
 * Uses functional update via setValue(prev => ...) to avoid stale closure.
 */
function replaceInValue(
  setValue: (updater: (prev: string) => string) => void,
  marker: string,
  replacement: string,
) {
  setValue(prev => prev.includes(marker) ? prev.replace(marker, replacement) : prev)
}

interface UsePasteUploadOptions {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  /** Functional setter so we can replace markers without stale-state races. */
  setValue: (updater: (prev: string) => string) => void
  /** Imperative setter used for the initial insert (we have full new value). */
  setValueRaw: (next: string) => void
}

export function usePasteUpload({ textareaRef, setValue, setValueRaw }: UsePasteUploadOptions) {
  // Keep a ref to setValue so the paste handler closure doesn't go stale when
  // the parent re-renders with a new setState identity.
  const setValueRef = useRef(setValue)
  const setValueRawRef = useRef(setValueRaw)
  useEffect(() => { setValueRef.current = setValue }, [setValue])
  useEffect(() => { setValueRawRef.current = setValueRaw }, [setValueRaw])

  const onPaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items
    if (!items) return
    // Find the first image item; ignore everything else (let native paste handle text)
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
      // Silently allow no-op: nothing inserted, nothing pasted. We could fall
      // back to native paste, but at this point we've already preventDefault()'d.
      // The user just sees "nothing happened" — same as before this feature.
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

    // Insert "uploading" placeholder with a unique marker so concurrent pastes don't collide
    const uniq = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const placeholder = `\n[上传中... ${uniq}]\n`
    insertAtCursor(textarea, placeholder, (next) => setValueRawRef.current(next))

    try {
      const res = await web.uploadImage(file)
      if (res.success && res.url) {
        const fullUrl = `${window.location.origin}${res.url}`
        replaceInValue(setValueRef.current, placeholder, `\n${fullUrl}\n`)
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
```

- [ ] **Step 2: TypeScript 编译通过**

```bash
cd /Users/jiangxuan/Projects/v2fun && npx tsc --noEmit
```

Expected: 无输出

- [ ] **Step 3: Commit**

```bash
cd /Users/jiangxuan/Projects/v2fun && git add src/hooks/usePasteUpload.ts && git commit -m "feat(client): add usePasteUpload hook"
```

---

### Task 6: 接 `CreateTopic.tsx` 主题正文 textarea

**Files:**
- Modify: `src/pages/CreateTopic.tsx`

- [ ] **Step 1: import hook**

在文件顶部 import 区（约第 6 行）追加：

```typescript
import { usePasteUpload } from '../hooks/usePasteUpload'
```

- [ ] **Step 2: 在组件内（在 `const handleSubmit = async () => {` 之前）实例化 hook**

定位到 `// Auto-expand textarea` 之前（约第 54 行），在 `useEffect` 块**之前**插入：

```typescript
  const { onPaste } = usePasteUpload({
    textareaRef,
    setValue: (updater) => setContent(updater),
    setValueRaw: (next) => setContent(next),
  })
```

- [ ] **Step 3: 给正文 textarea 加 `onPaste` 属性**

找到第 162 行的 `<textarea ref={textareaRef} ...>`。在 `disabled={submitting}` 后追加：

```typescript
            onPaste={onPaste}
```

完整的 textarea 应该是：

```typescript
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            placeholder="正文内容（可选）"
            value={content}
            onChange={e => setContent(e.target.value)}
            disabled={submitting}
            onPaste={onPaste}
          />
```

- [ ] **Step 4: TypeScript 编译通过**

```bash
cd /Users/jiangxuan/Projects/v2fun && npx tsc --noEmit
```

Expected: 无输出

- [ ] **Step 5: Commit**

```bash
cd /Users/jiangxuan/Projects/v2fun && git add src/pages/CreateTopic.tsx && git commit -m "feat(create-topic): wire paste-to-upload into body textarea"
```

---

### Task 7: 接 `TopicDetail.tsx` 回复 textarea

**Files:**
- Modify: `src/pages/TopicDetail.tsx`

- [ ] **Step 1: import hook**

在文件顶部 import 区追加：

```typescript
import { usePasteUpload } from '../hooks/usePasteUpload'
```

- [ ] **Step 2: 在组件内实例化 hook**

定位到 `const textareaRef = useRef<HTMLTextAreaElement>(null)`（约 51 行）。在它**之后**追加：

```typescript
  const { onPaste: onReplyPaste } = usePasteUpload({
    textareaRef,
    setValue: (updater) => setReplyContent(updater),
    setValueRaw: (next) => setReplyContent(next),
  })
```

- [ ] **Step 3: 给回复 textarea 加 `onPaste`**

找到第 331 行的回复 textarea，在 `disabled={submitting}` 后追加：

```typescript
              onPaste={onReplyPaste}
```

- [ ] **Step 4: TypeScript 编译通过**

```bash
cd /Users/jiangxuan/Projects/v2fun && npx tsc --noEmit
```

Expected: 无输出

- [ ] **Step 5: Commit**

```bash
cd /Users/jiangxuan/Projects/v2fun && git add src/pages/TopicDetail.tsx && git commit -m "feat(topic-detail): wire paste-to-upload into reply textarea"
```

---

### Task 8: README 加自部署设置章节

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 找 README 里合适的位置插入新章节**

先看 README 结构：

```bash
cd /Users/jiangxuan/Projects/v2fun && grep -n "^##" README.md | head -20
```

- [ ] **Step 2: 在合适位置（"环境变量" 或 "部署" 章节附近，或者文件末尾）追加章节**

追加内容：

```markdown
## 启用图片粘贴上传（可选）

V2Fun 支持在发主题和回帖的输入框里 `Cmd+V` 直接粘贴图片，自动上传并插入链接。
此功能依赖 Telegram Bot，不配置则功能关闭（粘贴图片不会触发任何动作）。

### 配置步骤

1. Telegram 找 `@BotFather` 建一个 bot，记下 `TG_BOT_TOKEN`（形如 `123456:ABC-DEF...`）
2. 建一个 Telegram **私有**频道，把刚才的 bot 加进去并设为管理员（只勾"发送消息"权限即可）
3. 在频道里发条任意消息，把这条消息转发到 `@userinfobot`，拿到频道 `chat_id`（形如 `-1001234567890`，**负号开头**）
4. 在 `.env`（或 `docker-compose.yml` 的 environment 段）加：
   ```env
   TG_BOT_TOKEN=123456:ABC-DEF...
   TG_CHAT_ID=-1001234567890
   ```
5. 重启容器（`bash v2fun.sh update` 或 `docker compose restart`）

### 工作原理

- 图片实际存在你的 TG 私有频道里
- V2Fun 后端代理 `/img/<file_id>` → 302 重定向到 TG CDN
- bot token 永远不出后端，浏览者只看到 `/img/...` 短链接
- 单图上限 10MB，IP 限频 10/min

### 替换其他图床

只想换 sm.ms / EasyImage / S3？编辑 `server/imageHost.mjs`，按 `isEnabled / upload / resolve`
三个函数的签名替换实现即可，其他代码不用动。
```

- [ ] **Step 3: Commit**

```bash
cd /Users/jiangxuan/Projects/v2fun && git add README.md && git commit -m "docs: add self-host setup for paste-to-upload image hosting"
```

---

### Task 9: 本地真实 TG bot 端到端验证（提交前必跑）

**Files:** 仅 env 操作和手动测试，不改代码。

- [ ] **Step 1: 准备一个测试用 bot 和私有频道**

如果你已经有了，跳过。否则按 README 步骤 1-3 建。把 token 和 chat_id 准备好。

- [ ] **Step 2: 本地以带 env 的方式启动 server**

```bash
cd /Users/jiangxuan/Projects/v2fun && \
  TG_BOT_TOKEN='<你的 token>' \
  TG_CHAT_ID='<你的 chat_id>' \
  node server/index.mjs &
```

记下控制台输出的 `Access passcode: XXXXXX`。

- [ ] **Step 3: 用 curl 测一次纯后端上传（确认 TG 链路通）**

```bash
PASSCODE='<上一步打印的 passcode>'
COOKIE=$(curl -si -X POST http://localhost:3210/auth/verify-passcode \
  -H "Content-Type: application/json" \
  -d "{\"passcode\":\"$PASSCODE\"}" | grep -i '^set-cookie:' | head -1 | sed 's/^[Ss]et-[Cc]ookie: //' | cut -d';' -f1)
# 准备一张小图
curl -s -o /tmp/v2fun-test.jpg "https://httpbin.org/image/jpeg"
# capability
curl -s -H "Cookie: $COOKIE" http://localhost:3210/web/upload-capability
echo ""
# upload
RESP=$(curl -s -H "Cookie: $COOKIE" -F "file=@/tmp/v2fun-test.jpg" http://localhost:3210/web/upload-image)
echo "$RESP"
URL_PATH=$(echo "$RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('url',''))")
echo "URL_PATH = $URL_PATH"
# 跟随重定向取真实图
curl -sIL "http://localhost:3210$URL_PATH" | grep -iE '^(HTTP|location)' | head -10
```

Expected:
- capability: `{"success":true,"enabled":true,...}`
- upload: `{"success":true,"url":"/img/AgAC..."}`
- 跟随 302: 第一跳 `302 Location: https://api.telegram.org/file/...`，最终一个 200

如果 upload 返 `upstream_failed`，看 server 控制台日志，常见原因：bot 没被加进频道、chat_id 写错（要带负号）、bot 在频道里没"发送消息"权限。

- [ ] **Step 4: 跑 vite dev，浏览器实测主题创建场景**

另起一个终端：

```bash
cd /Users/jiangxuan/Projects/v2fun && npm run dev
```

打开 http://localhost:5173 → 输 passcode → 登录后进发主题页面 → 在正文 textarea 里 `Cmd+V` 一张截图（先用系统截图工具 Cmd+Shift+Ctrl+4 截屏到剪贴板）。

预期观察：
- 占位符 `[上传中... <id>]` 瞬间出现
- 1-3 秒后变成 `https://localhost:5173/img/...` 完整 URL
- 在 V2EX 实际发表前，可在 textarea 里看到 URL；这一步不真的发，确认 URL 形态正确即可

- [ ] **Step 5: 同样在 TopicDetail 回复 textarea 里 paste 一次验证**

打开任意话题详情页 → 在底部回复框里 paste 截图 → 占位符 → URL。

- [ ] **Step 6: 边界用例**

逐条验证：

| 测试 | 操作 | 预期 |
|---|---|---|
| 粘文字 | 复制一段文字 paste | 正常文字粘贴，无干扰 |
| 太大的图 | 准备 >10MB 的图 paste | `[图片太大，最大 10MB]` 1.5 秒后消失 |
| 无效 mime | 复制 SVG 或 BMP（如果剪贴板能装） | `[不支持的图片格式]` 1.5 秒后消失 |
| 离线 | DevTools Network 设 Offline，paste | `[上传失败：网络错误]` 永久 |

- [ ] **Step 7: 关掉 server 重起，env 不带 TG_BOT_TOKEN，验证退化**

```bash
kill %1 2>/dev/null
cd /Users/jiangxuan/Projects/v2fun && node server/index.mjs &
```

浏览器 hard refresh (Cmd+Shift+R，清 sessionStorage)→进发主题→ paste 截图。

预期：什么也不发生（占位符不出现）。

```bash
kill %1 2>/dev/null
```

- [ ] **Step 8: 全部通过后再进 Task 10。任何一项不通过 → 修代码 → 重测 → 再走 commit**

---

### Task 10: 部署到生产 + 生产验证

**Files:** 无（部署操作）

- [ ] **Step 1: 推送所有 commit 到 GitHub**

```bash
cd /Users/jiangxuan/Projects/v2fun && git push origin main
```

- [ ] **Step 2: 等 GHA 构建完成**

到 https://github.com/jx453331958/v2fun/actions 看最新 workflow 跑成功（约 3-5 分钟）。

- [ ] **Step 3: SSH 到生产机，在 `.env` / `docker-compose.yml` 加 TG env**

```bash
ssh jiangxuan@108.62.161.15
cd /home/jiangxuan/dockers/v2fun
# 编辑 docker-compose.yml 或 .env 加：
#   TG_BOT_TOKEN=<token>
#   TG_CHAT_ID=<chat_id>
```

**注意**：用户的全局规则要求对生产服务先弄清当前部署方式。这个项目的更新流程是 `bash v2fun.sh update`（不要 scp 覆盖）。env 改完后跑 update。

- [ ] **Step 4: 跑 update 拉新镜像**

```bash
# 仍在生产机上
bash v2fun.sh update
```

确认容器正常 up；查 logs 是否有 startup 错误：

```bash
docker compose logs --tail=50 v2fun
```

- [ ] **Step 5: 生产端到端验证**

用 chrome-devtools MCP（按 `~/.claude/CLAUDE.md` Chrome Debug Profile 段落的规范）：

1. `navigate_page` 到 https://v2fun.ohminicat.com
2. 登录后进发主题页面
3. 用 `evaluate_script` 模拟剪贴板 paste 一张图，或者人工 paste（推荐人工，最贴近真实场景）
4. 看占位符 → URL 流程
5. 把 URL 单独粘到 textarea 之后，不要真发主题（避免污染 V2EX），用浏览器直接打开那个 URL，确认图能渲染出来
6. 切到任意话题，回复框里再 paste 一次验证

- [ ] **Step 6: 收尾**

报告给用户：
- 提交 hash 列表
- 部署状态
- 生产验证截图或步骤记录
- TG bot/频道的资源描述（"已建测试用 bot，私有频道 xxx"）

---

## Self-Review

**Spec 覆盖检查**：

| Spec § | 任务 | 覆盖 |
|---|---|---|
| §2 决策表 7 条 | 全部 task 中的实现都遵循 | ✅ |
| §4 文件清单 7 项 | Task 2-8 一一对应 | ✅ |
| §5.1 capability 契约 | Task 3 Step 3 | ✅ |
| §5.2 upload 契约 | Task 3 Step 4 + Task 4 | ✅ |
| §5.3 /img/:fileId | Task 3 Step 5 | ✅ |
| §6.1 上传数据流 | Task 5 hook 实现 | ✅ |
| §6.2 浏览数据流 | Task 2 resolve + Task 3 路由 | ✅ |
| §7 错误矩阵 9 行 | Task 5 errorMessage + Task 9 Step 6 | ✅ |
| §8 安全 / 反滥用 | Task 3 uploadLimiter + multer 限制 + 复用 passcode | ✅ |
| §9 自部署 | Task 8 README | ✅ |
| §10 YAGNI 8 条 | 默认全部不实现 | ✅ |
| §11 测试 | Task 9（dev）+ Task 10（prod）| ✅ |

**Placeholder 扫描**：无 TBD / TODO / "add validation" 这类空话。

**类型 / 命名一致性**：
- `isEnabled / upload / resolve`（Task 2）与调用处（Task 3）一致
- `uploadImage / uploadCapability`（Task 4）与 hook 调用（Task 5）一致
- `error` codes 字符串集合（Task 3）与 hook errorMessage 映射（Task 5）一致
- `onPaste`（Task 5）与组件接入（Task 6, 7）一致

---

## 执行选择

Plan 完成。两种执行方式：

1. **Subagent-Driven**（推荐）：每个 Task 派一个新 subagent，我在每个 task 后审查
2. **Inline Execution**：在当前会话里按顺序执行，checkpoint 处暂停审查

—— 用户选哪个？
