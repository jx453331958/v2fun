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
const AUTH_FILE = path.join(DATA_DIR, 'auth.json')

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

// Generate or load a 32-byte app secret (AES-256 key)
function loadAppSecret() {
  // Override: env var takes priority (for platforms without persistent volumes)
  if (process.env.V2FUN_SECRET) {
    return crypto.createHash('sha256').update(process.env.V2FUN_SECRET).digest()
  }
  // Default: auto-managed file in data volume
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

// ── Auth data helpers ────────────────────────────────────
// AUTH_FILE stores: { session, cookie (encrypted base64), member }

function readAuthData() {
  try {
    if (!fs.existsSync(AUTH_FILE)) return null
    return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'))
  } catch {
    return null
  }
}

function writeAuthData(data) {
  fs.writeFileSync(AUTH_FILE, JSON.stringify(data), { encoding: 'utf-8', mode: 0o600 })
}

/** Verify session cookie and return true if valid */
function verifySession(req) {
  const sessionToken = parseCookie(req.headers.cookie, 'v2fun_session')
  if (!sessionToken) return false
  try {
    const data = readAuthData()
    if (!data) return false
    const expected = Buffer.from(data.session, 'utf-8')
    const actual = Buffer.from(hmac(sessionToken), 'utf-8')
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}

/** Get decrypted V2EX cookie from AUTH_FILE */
function getStoredCookie() {
  try {
    const data = readAuthData()
    if (!data || !data.cookie) return null
    return decrypt(Buffer.from(data.cookie, 'base64'))
  } catch {
    return null
  }
}

/** Build Cookie header: supports full cookie string or bare PB3_SESSION value */
function buildCookieHeader(cookie) {
  if (cookie.includes('=')) return cookie
  return `PB3_SESSION=${cookie}`
}

const FALLBACK_UA = 'Mozilla/5.0 (compatible; V2Fun/1.0)'

/** Extract forwarding headers from incoming request */
function getForwardHeaders(req) {
  return {
    userAgent: req.headers['user-agent'] || FALLBACK_UA,
    acceptLanguage: req.headers['accept-language'] || '',
  }
}

/** Verify V2EX cookie by fetching a page, return username if valid */
async function verifyV2exCookie(cookieStr, fwd) {
  const res = await fetch('https://www.v2ex.com/settings', {
    headers: {
      'Cookie': buildCookieHeader(cookieStr),
      'User-Agent': fwd.userAgent,
      'Accept': 'text/html,application/xhtml+xml',
      ...(fwd.acceptLanguage && { 'Accept-Language': fwd.acceptLanguage }),
    },
    redirect: 'manual',
  })
  // 302 means not logged in (redirects to /signin)
  if (res.status >= 300) return null
  const html = await res.text()
  // Settings page has: <a href="/member/username">
  // or the nav bar: <a href="/member/xxx" class="top">
  const match = html.match(/href="\/member\/([^"]+)"/)
  if (!match) return null
  return match[1]
}

/** Fetch once token from topic page */
async function fetchOnceToken(cookie, topicId, fwd) {
  const url = `https://www.v2ex.com/t/${topicId}`
  const cookieHeader = buildCookieHeader(cookie)
  const res = await fetch(url, {
    headers: {
      'Cookie': cookieHeader,
      'User-Agent': fwd.userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      ...(fwd.acceptLanguage && { 'Accept-Language': fwd.acceptLanguage }),
    },
    redirect: 'manual',
  })
  if (res.status >= 300) {
    const location = res.headers.get('location') || ''
    console.error(`[fetchOnce] ${url} → ${res.status}, location: ${location}`)
    const err = new Error('cookie_expired')
    err.detail = `V2EX 返回 ${res.status}${location ? ' → ' + location : ''}，Cookie 可能无效`
    throw err
  }
  const html = await res.text()
  const match = html.match(/(?:once=|once\/|"once"\s*(?:value|:)\s*"?)(\d{5,})/)
  if (!match) {
    const snippet = html.substring(0, 500).replace(/\n/g, ' ')
    console.error(`[fetchOnce] once not found in HTML (${html.length} bytes), snippet: ${snippet}`)
    const err = new Error('cookie_expired')
    err.detail = html.includes('/signin') ? 'V2EX 返回了登录页，Cookie 无效' : '页面中未找到 once token'
    throw err
  }
  return match[1]
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
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Max-Age', '86400')
    return res.sendStatus(204)
  }
  next()
})

// ── Auth: cookie-based login ────────────────────────────────
// User provides V2EX cookie string → server verifies, encrypts, stores.
// All subsequent V2EX requests use this cookie.

app.post('/auth/login', express.json({ limit: '8kb' }), async (req, res) => {
  const { cookie } = req.body
  if (!cookie || typeof cookie !== 'string' || cookie.length > 4096) {
    return res.status(400).json({ error: 'Invalid cookie' })
  }
  const fwd = getForwardHeaders(req)
  try {
    // Verify cookie against V2EX
    const username = await verifyV2exCookie(cookie, fwd)
    if (!username) {
      return res.status(401).json({ error: 'Cookie 无效或已过期' })
    }

    // Fetch member info via public v1 API
    const memberRes = await fetch(`https://www.v2ex.com/api/members/show.json?username=${encodeURIComponent(username)}`, {
      headers: { 'User-Agent': fwd.userAgent },
    })
    const member = memberRes.ok ? await memberRes.json() : { username }

    // Create session
    const sessionToken = crypto.randomBytes(32).toString('hex')
    const encryptedCookie = encrypt(cookie).toString('base64')
    writeAuthData({
      session: hmac(sessionToken),
      cookie: encryptedCookie,
      member,
    })
    setSessionCookie(res, sessionToken)
    res.json({ success: true, member })
  } catch (err) {
    console.error('[auth/login]', err)
    res.status(500).json({ error: '登录失败，请重试' })
  }
})

app.get('/auth/session', (req, res) => {
  if (!verifySession(req)) return res.json({ member: null })
  try {
    const data = readAuthData()
    res.json({ member: data?.member || null })
  } catch {
    res.json({ member: null })
  }
})

app.post('/auth/logout', (req, res) => {
  if (verifySession(req)) {
    try {
      if (fs.existsSync(AUTH_FILE)) fs.unlinkSync(AUTH_FILE)
    } catch { /* ignore */ }
  }
  setSessionCookie(res, '', 0)
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

/** Parse V2EX time string to Unix timestamp */
function parseRelativeTime(text) {
  const now = Date.now() / 1000
  if (!text) return now
  const t = text.replace(/<[^>]*>/g, '').trim()
  if (t === '刚刚') return now
  // Relative: "3 天前", "2 小时 31 分钟前"
  let offset = 0
  const days = t.match(/(\d+)\s*天/)
  const hours = t.match(/(\d+)\s*小时/)
  const mins = t.match(/(\d+)\s*分钟/)
  if (days) offset += parseInt(days[1]) * 86400
  if (hours) offset += parseInt(hours[1]) * 3600
  if (mins) offset += parseInt(mins[1]) * 60
  if (offset > 0) return now - offset
  // Absolute: YYYY-MM-DD or YYYY-MM-DD HH:MM:SS
  const abs = t.match(/(\d{4}-\d{2}-\d{2}[\s\dT:.+\-]*)/)
  if (abs) { const ts = new Date(abs[1].trim()).getTime(); if (!isNaN(ts)) return ts / 1000 }
  // Chinese format: "2024 年 12 月 24 日" or "2024年12月24日"
  const cn = t.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/)
  if (cn) return new Date(parseInt(cn[1]), parseInt(cn[2]) - 1, parseInt(cn[3])).getTime() / 1000
  return now
}

/** Parse absolute datetime string like "2024-12-24 19:24:23 +08:00" */
function parseAbsoluteTime(text) {
  if (!text) return Date.now() / 1000
  const ts = new Date(text).getTime()
  if (!isNaN(ts)) return ts / 1000
  return Date.now() / 1000
}

/** Scrape V2EX notifications page and return parsed notifications */
async function scrapeNotifications(cookie, page, fwd) {
  const url = `https://www.v2ex.com/notifications?p=${page}`
  const res = await fetch(url, {
    headers: {
      'Cookie': buildCookieHeader(cookie),
      'User-Agent': fwd.userAgent,
      'Accept': 'text/html,application/xhtml+xml',
      ...(fwd.acceptLanguage && { 'Accept-Language': fwd.acceptLanguage }),
    },
    redirect: 'manual',
  })
  if (res.status >= 300) return []
  const html = await res.text()

  const notifications = []
  // Split by notification cells: <div class="cell" id="n_xxxxx">
  const cells = html.split(/id="n_(\d+)"/)
  // cells: [before, id1, content1, id2, content2, ...]
  for (let i = 1; i < cells.length; i += 2) {
    const id = parseInt(cells[i])
    const content = cells[i + 1] || ''

    // Extract username from first /member/ link
    const userMatch = content.match(/href="\/member\/([^"]+)"/)
    const username = userMatch ? userMatch[1] : ''

    // Extract avatar
    const avatarMatch = content.match(/<img\s[^>]*src="([^"]*avatar[^"]*)"/)
    const avatar = avatarMatch ? avatarMatch[1].replace(/^\/\//, 'https://') : ''

    // Extract notification text (content of <span class="fade">)
    const fadeMatch = content.match(/<span class="fade">([\s\S]*?)<\/span>/)
    const text = fadeMatch ? fadeMatch[1].trim() : ''

    // Extract payload (reply content)
    const payloadMatch = content.match(/<div class="payload">([\s\S]*?)<\/div>/)
    const payload = payloadMatch ? payloadMatch[1].trim() : ''

    // Extract time from <span class="snow">
    const timeMatch = content.match(/<span class="snow">([\s\S]*?)<\/span>/)
    const created = parseRelativeTime(timeMatch ? timeMatch[1] : '')

    if (username || text) {
      notifications.push({
        id,
        member_id: 0,
        for_member_id: 0,
        text,
        payload: '',
        payload_rendered: payload,
        created: Math.floor(created),
        member: {
          id: 0,
          username,
          url: '',
          website: '',
          twitter: '',
          psn: '',
          github: '',
          btc: '',
          location: '',
          tagline: '',
          bio: '',
          avatar_mini: avatar,
          avatar_normal: avatar,
          avatar_large: avatar,
          avatar,
          created: 0,
        },
      })
    }
  }
  return notifications
}

/** Scrape V2EX topic page and return parsed replies + totalPages */
async function scrapeReplies(topicId, page, cookie, fwd) {
  const url = `https://www.v2ex.com/t/${topicId}?p=${page}`
  const headers = {
    'User-Agent': fwd.userAgent,
    'Accept': 'text/html,application/xhtml+xml',
    ...(fwd.acceptLanguage && { 'Accept-Language': fwd.acceptLanguage }),
  }
  if (cookie) {
    headers['Cookie'] = buildCookieHeader(cookie)
  }
  const res = await fetch(url, { headers, redirect: 'manual' })
  if (res.status >= 300) {
    return { replies: [], totalPages: 1 }
  }
  const html = await res.text()

  // Extract total pages from pagination
  let totalPages = 1
  const pageInputMatch = html.match(/<input[^>]*class="page_input"[^>]*max="(\d+)"/)
  if (pageInputMatch) {
    totalPages = parseInt(pageInputMatch[1])
  } else {
    const pageLinks = html.match(/<a[^>]*class="page_normal"[^>]*>(\d+)<\/a>/g)
    if (pageLinks) {
      for (const link of pageLinks) {
        const n = parseInt(link.match(/>(\d+)</)[1])
        if (n > totalPages) totalPages = n
      }
    }
    // Also check current page indicator
    const pageCurrent = html.match(/<span class="page_current">(\d+)<\/span>/)
    if (pageCurrent) {
      const n = parseInt(pageCurrent[1])
      if (n > totalPages) totalPages = n
    }
  }

  // Split by reply cells: id="r_12345"
  const replies = []
  const cells = html.split(/id="r_(\d+)"/)
  // cells: [before, id1, content1, id2, content2, ...]
  for (let i = 1; i < cells.length; i += 2) {
    const replyId = parseInt(cells[i])
    const content = cells[i + 1] || ''

    // Extract username
    const userMatch = content.match(/<strong><a href="\/member\/([^"]+)"/)
    const username = userMatch ? userMatch[1] : ''

    // Extract avatar
    const avatarMatch = content.match(/<img[^>]*class="avatar"[^>]*src="([^"]*)"/)
    if (!avatarMatch) {
      // Try alternate avatar pattern
      const altAvatar = content.match(/<img[^>]*src="([^"]*avatar[^"]*)"/)
      var avatarUrl = altAvatar ? altAvatar[1] : ''
    } else {
      var avatarUrl = avatarMatch[1]
    }
    avatarUrl = avatarUrl.replace(/^\/\//, 'https://')

    // Extract floor number
    const floorMatch = content.match(/<span class="no">(\d+)<\/span>/)
    const floor = floorMatch ? parseInt(floorMatch[1]) : 0

    // Extract time - prefer title attribute (exact datetime) over text content
    const agoTagMatch = content.match(/<span[^>]*class="ago"[^>]*>/)
    const agoTitleMatch = agoTagMatch ? agoTagMatch[0].match(/title="([^"]+)"/) : null
    const agoTextMatch = content.match(/<span[^>]*class="ago"[^>]*>([\s\S]*?)<\/span>/)
    const created = agoTitleMatch
      ? parseAbsoluteTime(agoTitleMatch[1])
      : parseRelativeTime(agoTextMatch ? agoTextMatch[1] : '')

    // Extract reply content
    const contentMatch = content.match(/<div class="reply_content">([\s\S]*?)<\/div>/)
    const contentRendered = contentMatch ? contentMatch[1].trim() : ''

    // Extract thanks count - V2EX may use ♥, ❤, ❤️, or &hearts;
    // Count can appear as: ♥ 3, <span class="small fade">3</span> near thank_area, etc.
    const thanksMatch = content.match(/(?:♥|❤️?|&hearts;)\s*(\d+)/)
      || content.match(/thank_area[\s\S]{0,100}?<span[^>]*>\s*(\d+)\s*<\/span>/)
    const thanks = thanksMatch ? parseInt(thanksMatch[1]) : 0

    // Check if thanked (presence of thanked class or thank_confirmed)
    const thanked = content.includes('thanked') || content.includes('thank_confirmed')

    if (username) {
      replies.push({
        id: replyId,
        content: '',
        content_rendered: contentRendered,
        member: {
          id: 0,
          username,
          url: '',
          website: '',
          twitter: '',
          psn: '',
          github: '',
          btc: '',
          location: '',
          tagline: '',
          bio: '',
          avatar_mini: avatarUrl,
          avatar_normal: avatarUrl,
          avatar_large: avatarUrl,
          avatar: avatarUrl,
          created: 0,
        },
        created: Math.floor(created),
        topic_id: topicId,
        thanked,
        thanks,
      })
    }
  }

  return { replies, totalPages }
}

/** Scrape V2EX node page and return parsed topics + totalPages */
async function scrapeNodeTopics(nodeName, page, cookie, fwd) {
  const url = `https://www.v2ex.com/go/${encodeURIComponent(nodeName)}?p=${page}`
  const headers = {
    'User-Agent': fwd.userAgent,
    'Accept': 'text/html,application/xhtml+xml',
    ...(fwd.acceptLanguage && { 'Accept-Language': fwd.acceptLanguage }),
  }
  if (cookie) {
    headers['Cookie'] = buildCookieHeader(cookie)
  }
  const res = await fetch(url, { headers, redirect: 'manual' })
  if (res.status >= 300) {
    return { topics: [], totalPages: 1 }
  }
  const html = await res.text()

  // Extract total pages from pagination
  let totalPages = 1
  const pageInputMatch = html.match(/<input[^>]*class="page_input"[^>]*max="(\d+)"/)
  if (pageInputMatch) {
    totalPages = parseInt(pageInputMatch[1])
  } else {
    const pageLinks = html.match(/<a[^>]*class="page_normal"[^>]*>(\d+)<\/a>/g)
    if (pageLinks) {
      for (const link of pageLinks) {
        const n = parseInt(link.match(/>(\d+)</)[1])
        if (n > totalPages) totalPages = n
      }
    }
  }

  // Parse topics by splitting on item_title markers
  // Split pattern: <span class="item_title"><a href="/t/{ID}
  // With capturing group, split produces: [preamble, id1, content1, id2, content2, ...]
  const topics = []
  const parts = html.split(/<span class="item_title"><a href="\/t\/(\d+)/)

  for (let i = 1; i < parts.length; i += 2) {
    const topicId = parseInt(parts[i])
    const after = parts[i + 1] || ''
    const before = parts[i - 1] || ''

    // Title: continues from the <a> tag after the topic ID
    const titleMatch = after.match(/[^"]*"[^>]*>([\s\S]*?)<\/a>/)
    const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : ''

    // Avatar: last <img> in the section before this item_title
    const avatarSection = before.slice(-600)
    let avatarUrl = ''
    const allImgs = [...avatarSection.matchAll(/<img[^>]*src="([^"]*)"[^>]*>/g)]
    if (allImgs.length > 0) {
      avatarUrl = allImgs[allImgs.length - 1][1]
    }
    avatarUrl = avatarUrl.replace(/^\/\//, 'https://')

    // Username: last /member/ link before item_title
    const memberMatches = [...avatarSection.matchAll(/href="\/member\/([^"]+)"/g)]
    const username = memberMatches.length > 0
      ? memberMatches[memberMatches.length - 1][1]
      : ''

    // Reply count
    const replyMatch = after.match(/class="count_(?:livid|orange)"[^>]*>(\d+)<\/a>/)
    const replies = replyMatch ? parseInt(replyMatch[1]) : 0

    // Last reply by
    const lastReplyMatch = after.match(/最后回复来自\s*<strong><a href="\/member\/([^"]+)"/)
    const lastReplyBy = lastReplyMatch ? lastReplyMatch[1] : ''

    // Created time: prefer absolute time from title attribute
    const timeMatch = after.match(/<span title="([^"]+)">/)
    let created = 0
    if (timeMatch) {
      created = Math.floor(new Date(timeMatch[1]).getTime() / 1000)
    }
    if (!created || isNaN(created)) {
      created = Math.floor(parseRelativeTime(after))
    }

    // Node info from the a.node link
    const nodeMatch = after.match(/<a class="node" href="\/go\/([^"]+)">([^<]+)<\/a>/)

    if (title) {
      topics.push({
        id: topicId,
        title,
        url: `https://www.v2ex.com/t/${topicId}`,
        content: '',
        content_rendered: '',
        syntax: 0,
        replies,
        member: {
          id: 0,
          username,
          url: '',
          website: '',
          twitter: '',
          psn: '',
          github: '',
          btc: '',
          location: '',
          tagline: '',
          bio: '',
          avatar_mini: avatarUrl,
          avatar_normal: avatarUrl,
          avatar_large: avatarUrl,
          avatar: avatarUrl,
          created: 0,
        },
        node: {
          id: 0,
          name: nodeMatch ? nodeMatch[1] : nodeName,
          url: '',
          title: nodeMatch ? nodeMatch[2] : nodeName,
          title_alternative: '',
          topics: 0,
          stars: 0,
          header: '',
          footer: '',
          avatar: '',
          avatar_mini: '',
          avatar_normal: '',
          avatar_large: '',
        },
        created,
        last_modified: created,
        last_touched: created,
        last_reply_by: lastReplyBy,
      })
    }
  }

  return { topics, totalPages }
}

app.get('/web/node/:nodeName', async (req, res) => {
  const nodeName = req.params.nodeName
  if (!nodeName) {
    return res.status(400).json({ error: '参数错误' })
  }
  const page = parseInt(req.query.p) || 1

  // Use stored cookie if available, but don't require it
  const cookie = verifySession(req) ? getStoredCookie() : null

  const fwd = getForwardHeaders(req)
  try {
    const { topics, totalPages } = await scrapeNodeTopics(nodeName, page, cookie, fwd)
    res.json({ success: true, result: topics, totalPages })
  } catch (err) {
    console.error('[web/node]', err)
    res.json({ success: true, result: [], totalPages: 1 })
  }
})

app.get('/web/replies/:topicId', async (req, res) => {
  const topicId = parseInt(req.params.topicId)
  if (!topicId || isNaN(topicId)) {
    return res.status(400).json({ error: '参数错误' })
  }
  const page = parseInt(req.query.p) || 1

  // Use stored cookie if available (for thanked status), but don't require it
  const cookie = verifySession(req) ? getStoredCookie() : null

  const fwd = getForwardHeaders(req)
  try {
    // V1 API returns all replies with correct Unix timestamps (ignores pagination);
    // web scraping provides paginated replies with thanked/thanks/totalPages.
    // Strategy: use scraped data as base, override timestamps from V1 API.
    const [v1Replies, scraped] = await Promise.all([
      fetch(`https://www.v2ex.com/api/replies/show.json?topic_id=${topicId}`, {
        headers: { 'User-Agent': fwd.userAgent },
      }).then(r => r.ok ? r.json() : []).catch(() => []),
      scrapeReplies(topicId, page, cookie, fwd),
    ])

    const { replies, totalPages } = scraped

    // Override scraped timestamps with V1 API timestamps (keyed by reply ID)
    if (v1Replies.length > 0) {
      const v1Map = new Map(v1Replies.map(r => [r.id, r]))
      for (const reply of replies) {
        const v1 = v1Map.get(reply.id)
        if (v1) {
          reply.created = v1.created
        }
      }
    }

    res.json({ success: true, result: replies, totalPages })
  } catch (err) {
    console.error('[web/replies]', err)
    res.json({ success: true, result: [], totalPages: 1 })
  }
})

app.get('/web/notifications', async (req, res) => {
  if (!verifySession(req)) return res.status(401).json({ error: '未登录' })
  const cookie = getStoredCookie()
  if (!cookie) return res.json({ success: true, result: [] })

  const page = parseInt(req.query.p) || 1
  const fwd = getForwardHeaders(req)
  try {
    const notifications = await scrapeNotifications(cookie, page, fwd)
    res.json({ success: true, result: notifications })
  } catch (err) {
    console.error('[web/notifications]', err)
    res.json({ success: true, result: [] })
  }
})

app.post('/web/reply', express.json({ limit: '16kb' }), async (req, res) => {
  if (!verifySession(req)) return res.status(401).json({ error: '未登录' })
  const cookie = getStoredCookie()
  if (!cookie) return res.json({ success: false, error: 'no_cookie' })

  const { topicId, content } = req.body
  if (!topicId || !content || typeof content !== 'string') {
    return res.status(400).json({ error: '参数错误' })
  }

  const fwd = getForwardHeaders(req)
  try {
    const once = await fetchOnceToken(cookie, topicId, fwd)
    const formData = new URLSearchParams()
    formData.append('content', content)
    formData.append('once', once)

    const postRes = await fetch(`https://www.v2ex.com/t/${topicId}`, {
      method: 'POST',
      headers: {
        'Cookie': buildCookieHeader(cookie),
        'User-Agent': fwd.userAgent,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://www.v2ex.com',
        'Referer': `https://www.v2ex.com/t/${topicId}`,
      },
      body: formData.toString(),
      redirect: 'follow',
    })

    const body = await postRes.text()
    const finalUrl = postRes.url || ''
    console.log(`[web/reply] POST /t/${topicId} → ${postRes.status}, url: ${finalUrl}, body: ${body.length} bytes`)

    // Check for signs of failure in the response
    if (finalUrl.includes('/signin') || body.includes('/signin')) {
      return res.json({ success: false, error: 'cookie_expired', message: 'Cookie 已过期，请重新登录' })
    }
    // V2EX shows error messages in <div class="problem">
    const problemMatch = body.match(/<div class="problem">([\s\S]*?)<\/div>/)
    if (problemMatch) {
      const errorText = problemMatch[1].replace(/<[^>]*>/g, '').trim()
      console.error(`[web/reply] V2EX error: ${errorText}`)
      return res.json({ success: false, error: 'reply_failed', message: errorText || '回复失败' })
    }
    // If we ended up on the topic page, consider it success
    if (finalUrl.includes(`/t/${topicId}`) || postRes.status === 200) {
      // Double-check: see if our content appears in the page
      if (body.includes(content.substring(0, 20))) {
        return res.json({ success: true })
      }
      // Content not found — might still be OK (pagination), trust the redirect
      console.log(`[web/reply] Reply content not found in response page, but URL looks OK`)
      return res.json({ success: true })
    }
    console.error(`[web/reply] Unexpected: status=${postRes.status}, url=${finalUrl}`)
    res.json({ success: false, error: 'reply_failed', message: '回复失败，请稍后重试' })
  } catch (err) {
    if (err.message === 'cookie_expired') {
      return res.json({ success: false, error: 'cookie_expired', message: err.detail || 'Cookie 已过期，请重新登录' })
    }
    console.error('[web]', err)
    res.json({ success: false, error: 'unknown', message: '操作失败' })
  }
})

app.post('/web/topic', express.json({ limit: '32kb' }), async (req, res) => {
  if (!verifySession(req)) return res.status(401).json({ error: '未登录' })
  const cookie = getStoredCookie()
  if (!cookie) return res.json({ success: false, error: 'no_cookie' })

  const { title, content, nodeName, syntax } = req.body
  if (!title || typeof title !== 'string') {
    return res.status(400).json({ error: '标题不能为空' })
  }
  if (!nodeName || typeof nodeName !== 'string') {
    return res.status(400).json({ error: '节点不能为空' })
  }

  const fwd = getForwardHeaders(req)
  const cookieHeader = buildCookieHeader(cookie)
  try {
    // Fetch once token from the write page
    const writeUrl = `https://www.v2ex.com/write?node=${encodeURIComponent(nodeName)}`
    const pageRes = await fetch(writeUrl, {
      headers: {
        'Cookie': cookieHeader,
        'User-Agent': fwd.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ...(fwd.acceptLanguage && { 'Accept-Language': fwd.acceptLanguage }),
      },
      redirect: 'manual',
    })
    if (pageRes.status >= 300) {
      const location = pageRes.headers.get('location') || ''
      return res.json({ success: false, error: 'cookie_expired', message: location.includes('/signin') ? 'Cookie 已过期，请重新登录' : `V2EX 返回 ${pageRes.status}` })
    }
    const pageHtml = await pageRes.text()
    const onceMatch = pageHtml.match(/(?:once=|once\/|"once"\s*(?:value|:)\s*"?)(\d{5,})/)
    if (!onceMatch) {
      if (pageHtml.includes('/signin')) {
        return res.json({ success: false, error: 'cookie_expired', message: 'Cookie 已过期，请重新登录' })
      }
      return res.json({ success: false, error: 'once_not_found', message: '无法获取 once token，请稍后重试' })
    }
    const once = onceMatch[1]

    // POST the topic form
    const formData = new URLSearchParams()
    formData.append('title', title)
    formData.append('content', content || '')
    formData.append('node_name', nodeName)
    formData.append('syntax', syntax || 'default')
    formData.append('once', once)

    const postRes = await fetch('https://www.v2ex.com/write', {
      method: 'POST',
      headers: {
        'Cookie': cookieHeader,
        'User-Agent': fwd.userAgent,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://www.v2ex.com',
        'Referer': writeUrl,
      },
      body: formData.toString(),
      redirect: 'follow',
    })

    const body = await postRes.text()
    const finalUrl = postRes.url || ''
    console.log(`[web/topic] POST /write → ${postRes.status}, url: ${finalUrl}, body: ${body.length} bytes`)

    // Check for signin redirect
    if (finalUrl.includes('/signin') || body.includes('/signin')) {
      return res.json({ success: false, error: 'cookie_expired', message: 'Cookie 已过期，请重新登录' })
    }

    // Check for V2EX error
    const problemMatch = body.match(/<div class="problem">([\s\S]*?)<\/div>/)
    if (problemMatch) {
      const errorText = problemMatch[1].replace(/<[^>]*>/g, '').trim()
      console.error(`[web/topic] V2EX error: ${errorText}`)
      return res.json({ success: false, error: 'create_failed', message: errorText || '发布失败' })
    }

    // Extract topic ID from final URL: /t/{id}
    const topicIdMatch = finalUrl.match(/\/t\/(\d+)/)
    if (topicIdMatch) {
      return res.json({ success: true, topicId: parseInt(topicIdMatch[1]) })
    }

    // Also try extracting from response body
    const bodyTopicMatch = body.match(/href="\/t\/(\d+)"/)
    if (bodyTopicMatch) {
      return res.json({ success: true, topicId: parseInt(bodyTopicMatch[1]) })
    }

    console.error(`[web/topic] Unexpected: status=${postRes.status}, url=${finalUrl}`)
    res.json({ success: false, error: 'create_failed', message: '发布失败，请稍后重试' })
  } catch (err) {
    if (err.message === 'cookie_expired') {
      return res.json({ success: false, error: 'cookie_expired', message: err.detail || 'Cookie 已过期，请重新登录' })
    }
    console.error('[web/topic]', err)
    res.json({ success: false, error: 'unknown', message: '操作失败' })
  }
})

app.post('/web/thank/topic/:id', express.json({ limit: '1kb' }), async (req, res) => {
  if (!verifySession(req)) return res.status(401).json({ error: '未登录' })
  const cookie = getStoredCookie()
  if (!cookie) return res.json({ success: false, error: 'no_cookie' })

  const topicId = req.params.id
  const fwd = getForwardHeaders(req)
  try {
    const once = await fetchOnceToken(cookie, topicId, fwd)
    const thankRes = await fetch(`https://www.v2ex.com/thank/topic/${topicId}?once=${once}`, {
      method: 'POST',
      headers: {
        'Cookie': buildCookieHeader(cookie),
        'User-Agent': fwd.userAgent,
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
      return res.json({ success: false, error: 'cookie_expired', message: err.detail || 'Cookie 已过期，请重新登录' })
    }
    console.error('[web]', err)
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

  const fwd = getForwardHeaders(req)
  try {
    const once = await fetchOnceToken(cookie, topicId, fwd)
    const thankRes = await fetch(`https://www.v2ex.com/thank/reply/${replyId}?once=${once}`, {
      method: 'POST',
      headers: {
        'Cookie': buildCookieHeader(cookie),
        'User-Agent': fwd.userAgent,
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
      return res.json({ success: false, error: 'cookie_expired', message: err.detail || 'Cookie 已过期，请重新登录' })
    }
    console.error('[web]', err)
    res.json({ success: false, error: 'unknown', message: '操作失败' })
  }
})

// ── Proxy /api/* → https://www.v2ex.com/api/* ─────────────
// For v2 API paths, inject stored V2EX cookie for authentication.
// For v1 API paths (public), pass through without auth.
const v2exProxy = createProxyMiddleware({
  target: 'https://www.v2ex.com',
  pathFilter: (path) => path === '/api' || path.startsWith('/api/'),
  changeOrigin: true,
  secure: true,
  timeout: 30000,
  proxyTimeout: 30000,
  on: {
    proxyReq: (proxyReq, req) => {
      // Forward original User-Agent
      const ua = req.headers['user-agent']
      if (ua) {
        proxyReq.setHeader('User-Agent', ua)
      }
      // For v2 API, inject stored cookie for auth
      if (req.url.startsWith('/api/v2/')) {
        const cookie = getStoredCookie()
        if (cookie) {
          proxyReq.setHeader('Cookie', buildCookieHeader(cookie))
        }
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
