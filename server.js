import http from 'http'
import fs   from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { fetchPropertyData } from './scraper.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT      = process.env.PORT || 3000
const DIST      = path.join(__dirname, 'dist')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)

  // ── API endpoint ──────────────────────────────────────────────────────────
  if (url.pathname === '/api/scrape') {
    const targetUrl = url.searchParams.get('url')
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Access-Control-Allow-Origin', '*')
    if (!targetUrl) {
      res.statusCode = 400
      return res.end(JSON.stringify({ ok: false, error: 'Missing url parameter' }))
    }
    try {
      const data = await fetchPropertyData(targetUrl)
      res.end(JSON.stringify({ ok: true, data }))
    } catch (err) {
      res.statusCode = 500
      res.end(JSON.stringify({ ok: false, error: err.message }))
    }
    return
  }

  // ── Static file serving ───────────────────────────────────────────────────
  let filePath = path.join(DIST, url.pathname)

  // Directory → try index.html inside it
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html')
  }

  // File not found → SPA fallback (all routes served by index.html)
  if (!fs.existsSync(filePath)) {
    filePath = path.join(DIST, 'index.html')
  }

  const ext = path.extname(filePath)
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream')
  // Cache assets (hashed filenames) aggressively; HTML never
  if (ext !== '.html') res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')

  fs.createReadStream(filePath).pipe(res)
})

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
