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

  const form = new FormData()
  form.append('chat_id', CHAT_ID)
  form.append('photo', new Blob([buffer], { type: mime }), filenameFor(mime))

  const res = await fetch(`${API_BASE}/sendPhoto`, { method: 'POST', body: form })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.ok) {
    const desc = json?.description || `HTTP ${res.status}`
    throw new Error(`tg_send_failed: ${desc}`)
  }
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
