import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3210

// CORS preflight — must come before proxy
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Max-Age', '86400')
    return res.sendStatus(204)
  }
  next()
})

// Proxy /api/* → https://www.v2ex.com/api/*
// IMPORTANT: no body-parsing middleware before this — raw stream forwarding
// NOTE: use pathFilter instead of app.use('/api', ...) so that the full
//       request path (including /api prefix) is preserved when forwarding.
const v2exProxy = createProxyMiddleware({
  target: 'https://www.v2ex.com',
  pathFilter: '/api',
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
    proxyRes: (proxyRes) => {
      // Inject CORS headers into every proxied response
      proxyRes.headers['access-control-allow-origin'] = '*'
      proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, PATCH, OPTIONS'
      proxyRes.headers['access-control-allow-headers'] = 'Content-Type, Authorization'
    },
    error: (err, req, res) => {
      console.error('[proxy error]', err.message)
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'V2EX API 不可达，请稍后重试' }))
      }
    },
  },
})

app.use(v2exProxy)

// Serve built frontend
const distPath = path.join(__dirname, '..', 'dist')
app.use(express.static(distPath))

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`V2Fun server running at http://0.0.0.0:${PORT}`)
})
