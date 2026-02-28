import http from 'http'
import fs   from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { fetchPropertyData } from './scraper.js'
import pg from 'pg'

// ── Database setup ────────────────────────────────────────────────────────────
let db = null

async function initDb() {
  if (!process.env.DATABASE_URL) return
  db = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await db.query(`
    CREATE TABLE IF NOT EXISTS store (
      id   INTEGER PRIMARY KEY DEFAULT 1,
      data JSONB   NOT NULL    DEFAULT '[]'::jsonb
    )
  `)
  await db.query(`INSERT INTO store (id, data) VALUES (1, '[]'::jsonb) ON CONFLICT DO NOTHING`)
  console.log('Database connected')
}

initDb().catch(err => console.warn('DB init failed (running without persistence):', err.message))

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

  // ── Data sync endpoints ───────────────────────────────────────────────────
  if (url.pathname === '/api/data') {
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Access-Control-Allow-Origin', '*')

    if (req.method === 'GET') {
      if (!db) return res.end(JSON.stringify({ ok: false, error: 'No database' }))
      const result = await db.query('SELECT data FROM store WHERE id = 1')
      return res.end(JSON.stringify({ ok: true, data: result.rows[0]?.data ?? [] }))
    }

    if (req.method === 'PUT') {
      if (!db) return res.end(JSON.stringify({ ok: false, error: 'No database' }))
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', async () => {
        try {
          const { data } = JSON.parse(body)
          await db.query('UPDATE store SET data = $1 WHERE id = 1', [JSON.stringify(data)])
          res.end(JSON.stringify({ ok: true }))
        } catch (err) {
          res.statusCode = 400
          res.end(JSON.stringify({ ok: false, error: err.message }))
        }
      })
      return
    }
  }

  // ── Scrape endpoint ───────────────────────────────────────────────────────
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
