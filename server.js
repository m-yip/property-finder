import http from 'http'
import fs   from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { fetchPropertyData } from './scraper.js'
import { handleBillingApi } from './billing.js'
import pg from 'pg'

// ── Helpers ───────────────────────────────────────────────────────────────────
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous 0/O 1/I
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

// ── Database setup ────────────────────────────────────────────────────────────
let db = null

async function initDb() {
  if (!process.env.DATABASE_URL) return
  db = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

  // Keep legacy store table
  await db.query(`
    CREATE TABLE IF NOT EXISTS store (
      id   INTEGER PRIMARY KEY DEFAULT 1,
      data JSONB   NOT NULL    DEFAULT '[]'::jsonb
    )
  `)
  await db.query(`INSERT INTO store (id, data) VALUES (1, '[]'::jsonb) ON CONFLICT DO NOTHING`)

  // New boards table — one row per board
  await db.query(`
    CREATE TABLE IF NOT EXISTS boards (
      code       TEXT PRIMARY KEY,
      data       JSONB NOT NULL DEFAULT '[]'::jsonb,
      name       TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  // Add name column if upgrading from old schema
  await db.query(`ALTER TABLE boards ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT ''`)

  // Meta table — stores migration info
  await db.query(`
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  // One-time migration: copy legacy store data into a board
  const alreadyMigrated = await db.query("SELECT value FROM meta WHERE key = 'migration_board'")
  if (!alreadyMigrated.rows.length) {
    const storeResult = await db.query('SELECT data FROM store WHERE id = 1')
    const existing = storeResult.rows[0]?.data
    if (Array.isArray(existing) && existing.length > 0) {
      const code = generateCode()
      await db.query('INSERT INTO boards (code, data) VALUES ($1, $2) ON CONFLICT DO NOTHING', [code, JSON.stringify(existing)])
      await db.query("INSERT INTO meta (key, value) VALUES ('migration_board', $1)", [code])
      console.log(`MIGRATION: ${existing.length} existing properties moved to board ${code}`)
    }
  }

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

  // ── Accounts, funnel events, plans & checkout ──────────────────────────────
  if (await handleBillingApi(req, res)) return

  // ── Board endpoints ───────────────────────────────────────────────────────

  // POST /api/boards — create a new board, return its code
  if (url.pathname === '/api/boards' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Access-Control-Allow-Origin', '*')
    if (!db) return res.end(JSON.stringify({ ok: false, error: 'No database' }))
    let body = ''
    req.on('data', chunk => { body += chunk })
    await new Promise(resolve => req.on('end', resolve))
    let name = ''
    try { name = JSON.parse(body).name || '' } catch {}
    const code = generateCode()
    await db.query('INSERT INTO boards (code, data, name) VALUES ($1, $2, $3)', [code, '[]', name])
    return res.end(JSON.stringify({ ok: true, code }))
  }

  // GET /api/boards/:code  — load board data
  // PUT /api/boards/:code  — save board data
  const boardMatch = url.pathname.match(/^\/api\/boards\/([A-Z0-9]+)$/)
  if (boardMatch) {
    const code = boardMatch[1]
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Access-Control-Allow-Origin', '*')

    if (req.method === 'GET') {
      if (!db) return res.end(JSON.stringify({ ok: false, error: 'No database' }))
      const result = await db.query('SELECT data, name FROM boards WHERE code = $1', [code])
      if (!result.rows.length) {
        res.statusCode = 404
        return res.end(JSON.stringify({ ok: false, error: 'Board not found' }))
      }
      return res.end(JSON.stringify({ ok: true, data: result.rows[0].data, name: result.rows[0].name || '' }))
    }

    if (req.method === 'PATCH') {
      if (!db) return res.end(JSON.stringify({ ok: false, error: 'No database' }))
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', async () => {
        try {
          const { name } = JSON.parse(body)
          await db.query('UPDATE boards SET name = $1 WHERE code = $2', [name || '', code])
          res.end(JSON.stringify({ ok: true }))
        } catch (err) {
          res.statusCode = 400
          res.end(JSON.stringify({ ok: false, error: err.message }))
        }
      })
      return
    }

    if (req.method === 'PUT') {
      if (!db) return res.end(JSON.stringify({ ok: false, error: 'No database' }))
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', async () => {
        try {
          const { data } = JSON.parse(body)
          await db.query('UPDATE boards SET data = $1 WHERE code = $2', [JSON.stringify(data), code])
          res.end(JSON.stringify({ ok: true }))
        } catch (err) {
          res.statusCode = 400
          res.end(JSON.stringify({ ok: false, error: err.message }))
        }
      })
      return
    }
  }

  // GET /api/migration — returns migration board code if one exists
  if (url.pathname === '/api/migration' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Access-Control-Allow-Origin', '*')
    if (!db) return res.end(JSON.stringify({ ok: false }))
    const result = await db.query("SELECT value FROM meta WHERE key = 'migration_board'")
    if (result.rows.length) return res.end(JSON.stringify({ ok: true, code: result.rows[0].value }))
    return res.end(JSON.stringify({ ok: false }))
  }

  // ── Legacy data endpoint (kept for safety) ────────────────────────────────
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

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html')
  }

  if (!fs.existsSync(filePath)) {
    filePath = path.join(DIST, 'index.html')
  }

  const ext = path.extname(filePath)
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream')
  if (ext !== '.html') res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')

  fs.createReadStream(filePath).pipe(res)
})

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
