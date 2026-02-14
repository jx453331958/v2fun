import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import rateLimit from 'express-rate-limit'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3210

// ── Persistent data (mount as Docker volume) ─────────────
const DATA_DIR = path.join(__dirname, '..', 'data')
const SECRET_FILE = path.join(DATA_DIR, '.secret')
const AUTH_FILE = path.join(DATA_DIR, 'auth.enc')
const COOKIE_FILE = path.join(DATA_DIR, 'cookie.enc')

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

// Generate or load a 32-byte app secret (AES-256 key)
function loadAppSecret() {
  if (fs.existsSync(SECRET_FILE)) {
    const buf = fs.readFileSync(SECRET_FILE)
    if (buf.length === 32) return buf
  }
  const secret = crypto.randomBytes(32)
  fs.writeFileSync(SECRET_FILE, secret, { mode: 0o600 })
  return secret
}
const APP_SECRET = loadAppSecret()

// ── Crypto helpers ────────────────────────────────────────

function encrypt(text) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', APP_SECRET, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // layout: iv(12) + tag(16) + ciphertext
  return Buffer.concat([iv, tag, encrypted])
}

function decrypt(buf) {
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const encrypted = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', APP_SECRET, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

function hmac(value) {
  return crypto.createHmac('sha256', APP_SECRET).update(value).digest('hex')
}

function parseCookie(header, name) {
  if (!header) return null
  for (const pair of header.split(';')) {
    const idx = pair.indexOf('=')
    if (idx === -1) continue
    if (pair.slice(0, idx).trim() === name) return pair.slice(idx + 1).trim()
  }
  return null
}

function setSessionCookie(res, value, maxAge = 365 * 24 * 3600) {
  const parts = [
    `v2fun_session=${value}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${maxAge}`,
  ]
  // Set Secure flag when behind TLS (reverse proxy sets X-Forwarded-Proto)
  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure')
  }
  res.setHeader('Set-Cookie', parts.join('; '))
}

/** Verify session cookie and return true if valid */
function verifySession(req) {
  const sessionToken = parseCookie(req.headers.cookie, 'v2fun_session')
  if (!sessionToken) return false
  try {
    if (!fs.existsSync(AUTH_FILE)) return false
    const data = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'))
    const expected = Buffer.from(data.session, 'utf-8')
    const actual = Buffer.from(hmac(sessionToken), 'utf-8')
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}

// ── Security hardening ────────────────────────────────────

app.disable('x-powered-by')

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1)
}

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https://cdn.v2ex.com https://*.v2ex.com https://cdn.v2ex.co https://*.v2ex.co data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; '))
  next()
})

// Rate limiting on auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁，请稍后重试' },
})
app.use('/auth', authLimiter)

// ── CORS preflight — must come before proxy ───────────────
// No wildcard — frontend and API are same-origin in production.
// Only needed for dev with Vite proxy (which handles CORS itself).
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Max-Age', '86400')
    return res.sendStatus(204)
  }
  next()
})

// ── Secure token persistence ──────────────────────────────
// - Token encrypted at rest with AES-256-GCM
// - Retrieval requires a valid HttpOnly session cookie
// - Cookie verified via HMAC-SHA256 (timing-safe comparison)

app.post('/auth/login', express.json({ limit: '2kb' }), (req, res) => {
  const { token } = req.body
  if (!token || typeof token !== 'string' || token.length > 512) {
    return res.status(400).json({ error: 'Invalid token' })
  }
  try {
    const sessionToken = crypto.randomBytes(32).toString('hex')
    const encryptedToken = encrypt(token).toString('base64')
    const data = { token: encryptedToken, session: hmac(sessionToken) }
    fs.writeFileSync(AUTH_FILE, JSON.stringify(data), { encoding: 'utf-8', mode: 0o600 })
    setSessionCookie(res, sessionToken)
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Failed to save' })
  }
})

app.get('/auth/session', (req, res) => {
  const sessionToken = parseCookie(req.headers.cookie, 'v2fun_session')
  if (!sessionToken) return res.json({ token: null })

  try {
    if (!fs.existsSync(AUTH_FILE)) return res.json({ token: null })
    const data = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'))

    // Timing-safe comparison to prevent timing attacks
    const expected = Buffer.from(data.session, 'utf-8')
    const actual = Buffer.from(hmac(sessionToken), 'utf-8')
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
      return res.json({ token: null })
    }

    const token = decrypt(Buffer.from(data.token, 'base64'))
    res.json({ token })
  } catch {
    res.json({ token: null })
  }
})

app.post('/auth/logout', (req, res) => {
  // Only allow logout if the requester holds a valid session
  if (verifySession(req)) {
    try {
      if (fs.existsSync(AUTH_FILE)) fs.unlinkSync(AUTH_FILE)
      if (fs.existsSync(COOKIE_FILE)) fs.unlinkSync(COOKIE_FILE)
    } catch { /* ignore */ }
  }
  setSessionCookie(res, '', 0)
  res.json({ success: true })
})

// ── V2EX Cookie management ──────────────────────────────────

function getStoredCookie() {
  if (!fs.existsSync(COOKIE_FILE)) return null
  try {
    const buf = fs.readFileSync(COOKIE_FILE)
    return decrypt(buf)
  } catch {
    return null
  }
}

async function fetchOnceToken(cookie, topicId) {
  const url = `https://www.v2ex.com/t/${topicId}`
  const res = await fetch(url, {
    headers: {
      'Cookie': `PB3_SESSION=${cookie}`,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    },
    redirect: 'manual',
  })
  // 302 or non-200 means cookie expired / invalid
  if (res.status >= 300) {
    throw new Error('cookie_expired')
  }
  const html = await res.text()
  // V2EX embeds once token in forms and AJAX URLs
  const match = html.match(/once=(\d+)/) || html.match(/name="once" value="(\d+)"/)
  if (!match) {
    throw new Error('cookie_expired')
  }
  return match[1]
}

app.post('/auth/cookie', express.json({ limit: '4kb' }), (req, res) => {
  if (!verifySession(req)) return res.status(401).json({ error: '未登录' })
  const { cookie } = req.body
  if (!cookie || typeof cookie !== 'string' || cookie.length > 1024) {
    return res.status(400).json({ error: 'Invalid cookie' })
  }
  try {
    const buf = encrypt(cookie)
    fs.writeFileSync(COOKIE_FILE, buf, { mode: 0o600 })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Failed to save cookie' })
  }
})

app.get('/auth/cookie', (req, res) => {
  if (!verifySession(req)) return res.json({ hasCookie: false })
  res.json({ hasCookie: fs.existsSync(COOKIE_FILE) })
})

app.delete('/auth/cookie', (req, res) => {
  if (!verifySession(req)) return res.status(401).json({ error: '未登录' })
  try {
    if (fs.existsSync(COOKIE_FILE)) fs.unlinkSync(COOKIE_FILE)
  } catch { /* ignore */ }
  res.json({ success: true })
})

// ── Web operation proxy (reply / thank) ─────────────────────

const webLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '操作过于频繁，请稍后重试' },
})
app.use('/web', webLimiter)

app.post('/web/reply', express.json({ limit: '16kb' }), async (req, res) => {
  if (!verifySession(req)) return res.status(401).json({ error: '未登录' })
  const cookie = getStoredCookie()
  if (!cookie) return res.json({ success: false, error: 'no_cookie' })

  const { topicId, content } = req.body
  if (!topicId || !content || typeof content !== 'string') {
    return res.status(400).json({ error: '参数错误' })
  }

  try {
    const once = await fetchOnceToken(cookie, topicId)
    const formData = new URLSearchParams()
    formData.append('content', content)
    formData.append('once', once)

    const postRes = await fetch(`https://www.v2ex.com/t/${topicId}`, {
      method: 'POST',
      headers: {
        'Cookie': `PB3_SESSION=${cookie}`,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://www.v2ex.com',
        'Referer': `https://www.v2ex.com/t/${topicId}`,
      },
      redirect: 'manual',
    })

    // V2EX redirects to the topic page on success (302)
    if (postRes.status === 302 || postRes.status === 200) {
      return res.json({ success: true })
    }
    res.json({ success: false, error: 'reply_failed', message: '回复失败，请稍后重试' })
  } catch (err) {
    if (err.message === 'cookie_expired') {
      return res.json({ success: false, error: 'cookie_expired', message: 'Cookie 已过期，请重新设置' })
    }
    res.json({ success: false, error: 'unknown', message: '操作失败' })
  }
})

app.post('/web/thank/topic/:id', express.json({ limit: '1kb' }), async (req, res) => {
  if (!verifySession(req)) return res.status(401).json({ error: '未登录' })
  const cookie = getStoredCookie()
  if (!cookie) return res.json({ success: false, error: 'no_cookie' })

  const topicId = req.params.id
  try {
    const once = await fetchOnceToken(cookie, topicId)
    const thankRes = await fetch(`https://www.v2ex.com/thank/topic/${topicId}?once=${once}`, {
      method: 'POST',
      headers: {
        'Cookie': `PB3_SESSION=${cookie}`,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Referer': `https://www.v2ex.com/t/${topicId}`,
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    const data = await thankRes.json().catch(() => ({}))
    if (thankRes.ok && data.success !== false) {
      return res.json({ success: true })
    }
    res.json({ success: false, error: 'thank_failed', message: '感谢失败' })
  } catch (err) {
    if (err.message === 'cookie_expired') {
      return res.json({ success: false, error: 'cookie_expired', message: 'Cookie 已过期，请重新设置' })
    }
    res.json({ success: false, error: 'unknown', message: '操作失败' })
  }
})

app.post('/web/thank/reply/:id', express.json({ limit: '1kb' }), async (req, res) => {
  if (!verifySession(req)) return res.status(401).json({ error: '未登录' })
  const cookie = getStoredCookie()
  if (!cookie) return res.json({ success: false, error: 'no_cookie' })

  const replyId = req.params.id
  const { topicId } = req.body
  if (!topicId) return res.status(400).json({ error: '参数错误' })

  try {
    const once = await fetchOnceToken(cookie, topicId)
    const thankRes = await fetch(`https://www.v2ex.com/thank/reply/${replyId}?once=${once}`, {
      method: 'POST',
      headers: {
        'Cookie': `PB3_SESSION=${cookie}`,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Referer': `https://www.v2ex.com/t/${topicId}`,
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    const data = await thankRes.json().catch(() => ({}))
    if (thankRes.ok && data.success !== false) {
      return res.json({ success: true })
    }
    res.json({ success: false, error: 'thank_failed', message: '感谢失败' })
  } catch (err) {
    if (err.message === 'cookie_expired') {
      return res.json({ success: false, error: 'cookie_expired', message: 'Cookie 已过期，请重新设置' })
    }
    res.json({ success: false, error: 'unknown', message: '操作失败' })
  }
})

// ── Proxy /api/* → https://www.v2ex.com/api/* ─────────────
// IMPORTANT: no body-parsing middleware before this — raw stream forwarding
// NOTE: use pathFilter instead of app.use('/api', ...) so that the full
//       request path (including /api prefix) is preserved when forwarding.
const v2exProxy = createProxyMiddleware({
  target: 'https://www.v2ex.com',
  pathFilter: (path) => path === '/api' || path.startsWith('/api/'),
  changeOrigin: true,
  secure: true,
  timeout: 30000,
  proxyTimeout: 30000,
  headers: {
    'User-Agent': 'V2Fun/1.0',
  },
  on: {
    proxyReq: (proxyReq, req) => {
      // Forward auth token
      const auth = req.headers['authorization']
      if (auth) {
        proxyReq.setHeader('Authorization', auth)
      }
      // Ensure content-type is forwarded for POST/PUT
      const ct = req.headers['content-type']
      if (ct) {
        proxyReq.setHeader('Content-Type', ct)
      }
    },
    error: (err, _req, res) => {
      console.error('[proxy error]', err.code || 'UNKNOWN')
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'V2EX API 不可达，请稍后重试' }))
      }
    },
  },
})

app.use(v2exProxy)

// Serve built frontend — hashed assets cached aggressively
const distPath = path.join(__dirname, '..', 'dist')
app.use(express.static(distPath, {
  maxAge: '1y',
  immutable: true,
  index: false,
}))

// SPA fallback — index.html must NOT be cached
app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache')
  res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`V2Fun server running at http://0.0.0.0:${PORT}`)
})
