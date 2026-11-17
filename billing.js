// ── Accounts, funnel events and plans — shared by vite.config.js (dev) and server.js (prod) ──
//
// Storage: Postgres when DATABASE_URL is set, otherwise a local JSON file (.data/dev-store.json).
// Payments: demo mode unlocks instantly. Set STRIPE_SECRET_KEY and STRIPE_PRICE_TEN (the £9.99
// Search pass) to use real Stripe Checkout. Secrets are only ever read from env.

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import pg from 'pg'

export const PLANS = {
  free:      { label: 'Free',        homes: 5,    scorecards: null },       // 3 to start, 5 with an email (email is captured at sign-up)
  ten:       { label: 'Search pass', homes: null, price: 999,  boards: 1 }, // pence. The one paid plan: unlimited homes, one board, forever. (id kept as 'ten' so stored data and Stripe env names still match)
  unlimited: { label: 'Unlimited',   homes: null, price: 1500, boards: null }, // legacy: no longer offered, still honoured for existing buyers
  beta:      { label: 'Free beta',   homes: null }, // everyone, while BETA_FREE isn't '0'
}
const betaFree = () => process.env.BETA_FREE !== '0'
export const FREE_SCORE_AFTER = null // no scorecard paywall: the free limit is on homes only

const EVENTS = new Set([
  'landing_view', 'landing_cta', 'app_open', 'onboarding_view', 'email_submitted', 'board_created', 'board_joined',
  'listing_added', 'scorecard_started', 'scorecard_saved', 'paywall_shown', 'paywall_dismissed', 'plan_selected',
  'checkout_started', 'purchase_completed', 'search_setup',
  'waitlist_view', 'waitlist_joined', 'waitlist_shared',
])

// ── Storage adapter ─────────────────────────────────────────────────────────────
function jsonStore(file) {
  const load = () => { try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return { users: {}, boardPlans: {}, events: [] } } }
  const save = s => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(s, null, 2)) }
  return {
    async upsertUser(u) {
      const s = load(), prev = s.users[u.email] || { plan: 'free', createdAt: new Date().toISOString() }
      s.users[u.email] = { ...prev, ...u, plan: prev.plan, attribution: prev.attribution || u.attribution }
      save(s); return s.users[u.email]
    },
    async getUser(email) { return load().users[email] || null },
    async setUserPlan(email, plan) { const s = load(); s.users[email] = { ...(s.users[email] || { email }), plan, planAt: new Date().toISOString() }; save(s) },
    async getBoardPlan(code) { return load().boardPlans[code] || null },
    async setBoardPlan(code, v) {
      const s = load(), prev = s.boardPlans[code] || {}
      s.boardPlans[code] = { ...prev, ...Object.fromEntries(Object.entries(v).filter(([, x]) => x != null)), owner: prev.owner || v.owner || null }
      save(s)
    },
    async addEvent(e) { const s = load(); s.events.push({ ...e, ts: new Date().toISOString() }); save(s) },
    async funnel() {
      const s = load(), by = {}
      for (const e of s.events) (by[e.event] ||= new Set()).add(e.anonId || e.email)
      return { counts: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, v.size])), users: Object.keys(s.users).length }
    },
    async users() { return Object.values(load().users) },
  }
}

function pgStore(pool) {
  const ready = (async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '', marketing BOOLEAN NOT NULL DEFAULT FALSE,
      plan TEXT NOT NULL DEFAULT 'free', plan_at TIMESTAMPTZ, attribution JSONB, created_at TIMESTAMPTZ DEFAULT NOW())`)
    await pool.query(`CREATE TABLE IF NOT EXISTS board_plans (
      code TEXT PRIMARY KEY, owner_email TEXT, plan TEXT NOT NULL DEFAULT 'free', paid_by TEXT, updated_at TIMESTAMPTZ DEFAULT NOW())`)
    await pool.query(`CREATE TABLE IF NOT EXISTS events (
      id BIGSERIAL PRIMARY KEY, ts TIMESTAMPTZ DEFAULT NOW(), event TEXT NOT NULL, anon_id TEXT, email TEXT, board TEXT, props JSONB)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS events_event_idx ON events (event)`)
  })()
  const q = async (sql, args) => { await ready; return pool.query(sql, args) }
  const user = r => r && { email: r.email, name: r.name, marketing: r.marketing, plan: r.plan, attribution: r.attribution }
  return {
    async upsertUser(u) {
      const r = await q(`INSERT INTO users (email, name, marketing, attribution) VALUES ($1, $2, $3, $4)
        ON CONFLICT (email) DO UPDATE SET name = COALESCE(NULLIF(EXCLUDED.name, ''), users.name), marketing = EXCLUDED.marketing
        RETURNING *`, [u.email, u.name || '', !!u.marketing, u.attribution || null])
      return user(r.rows[0])
    },
    async getUser(email) { return user((await q('SELECT * FROM users WHERE email = $1', [email])).rows[0]) },
    async setUserPlan(email, plan) {
      await q(`INSERT INTO users (email, plan, plan_at) VALUES ($1, $2, NOW()) ON CONFLICT (email) DO UPDATE SET plan = $2, plan_at = NOW()`, [email, plan])
    },
    async getBoardPlan(code) {
      const r = (await q('SELECT * FROM board_plans WHERE code = $1', [code])).rows[0]
      return r && { owner: r.owner_email, plan: r.plan, paidBy: r.paid_by }
    },
    async setBoardPlan(code, v) {
      await q(`INSERT INTO board_plans (code, owner_email, plan, paid_by) VALUES ($1, $2, COALESCE($3, 'free'), $4)
        ON CONFLICT (code) DO UPDATE SET owner_email = COALESCE(board_plans.owner_email, EXCLUDED.owner_email),
          plan = COALESCE($3, board_plans.plan), paid_by = COALESCE($4, board_plans.paid_by), updated_at = NOW()`,
        [code, v.owner || null, v.plan || null, v.paidBy || null])
    },
    async addEvent(e) {
      await q('INSERT INTO events (event, anon_id, email, board, props) VALUES ($1, $2, $3, $4, $5)', [e.event, e.anonId || null, e.email || null, e.board || null, e.props || null])
    },
    async funnel() {
      const r = await q(`SELECT event, COUNT(DISTINCT COALESCE(anon_id, email)) AS n FROM events GROUP BY event`)
      const u = await q('SELECT COUNT(*) AS n FROM users')
      return { counts: Object.fromEntries(r.rows.map(x => [x.event, Number(x.n)])), users: Number(u.rows[0].n) }
    },
    async users() { return (await q('SELECT email, name, marketing, plan, created_at, attribution FROM users ORDER BY created_at DESC')).rows },
  }
}

const store = process.env.DATABASE_URL
  ? pgStore(new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }))
  : jsonStore(path.join(process.cwd(), '.data', 'dev-store.json'))

// ── Entitlements ────────────────────────────────────────────────────────────────
// A plan bought on a board covers everyone on it. Unlimited also covers every board the buyer owns.
async function entitlement(board, email) {
  const bp = board ? await store.getBoardPlan(board) : null
  if (betaFree()) return { plan: 'beta', homes: null, freeScoreAfter: null, owner: bp?.owner || null, demo: !stripeEnabled() }
  let plan = bp?.plan || 'free'
  if (plan !== 'unlimited' && bp?.owner) {
    const owner = await store.getUser(bp.owner)
    if (owner?.plan === 'unlimited') plan = 'unlimited'
  }
  if (plan !== 'unlimited' && email && bp?.owner === email) {
    const me = await store.getUser(email)
    if (me?.plan === 'unlimited') plan = 'unlimited'
  }
  return { plan, homes: PLANS[plan].homes, freeScoreAfter: FREE_SCORE_AFTER, owner: bp?.owner || null, demo: !stripeEnabled() }
}

async function grant(board, email, plan) {
  if (plan === 'unlimited') await store.setUserPlan(email, 'unlimited')
  await store.setBoardPlan(board, { owner: email, plan, paidBy: email })
  await store.addEvent({ event: 'purchase_completed', email, board, props: { plan, amount: PLANS[plan].price } })
}

// ── Stripe (REST, no SDK) ───────────────────────────────────────────────────────
const stripeEnabled = () => !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_TEN)
async function stripe(method, endpoint, params) {
  const res = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params ? new URLSearchParams(params).toString() : undefined,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message || 'Stripe error')
  return json
}

// ── Sign-ups sheet + CSV ────────────────────────────────────────────────────────
// People who tick "send me updates" are also added to the Google Sheet (docs/signups-sheet.gs).
// Fire-and-forget: a slow or missing sheet never blocks sign-up.
function addToSignupsSheet(row) {
  const url = process.env.SIGNUPS_SHEET_URL
  if (!url) return
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(row) })
    .catch(err => console.error('Sign-ups sheet:', err.message))
}
// Quote for CSV, and stop spreadsheet apps running values like "=HYPERLINK(...)" as formulas
function csvCell(v) {
  let s = v instanceof Date ? v.toISOString() : String(v ?? '')
  if (/^[=+\-@]/.test(s)) s = "'" + s
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

// ── HTTP ────────────────────────────────────────────────────────────────────────
const isEmail = e => typeof e === 'string' && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)
const clean = (v, n = 200) => typeof v === 'string' ? v.slice(0, n) : undefined
async function readJson(req) {
  let body = ''
  for await (const chunk of req) { body += chunk; if (body.length > 20000) throw new Error('Body too large') }
  return body ? JSON.parse(body) : {}
}

// Returns true when the request was handled
export async function handleBillingApi(req, res) {
  const url = new URL(req.url, 'http://localhost')
  const p = url.pathname
  if (!/^\/api\/(users|events|entitlement|checkout|admin)/.test(p)) return false

  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return true }
  const send = (code, body) => { res.statusCode = code; res.end(JSON.stringify(body)); return true }

  try {
    // POST /api/users — onboarding email capture
    if (p === '/api/users' && req.method === 'POST') {
      const b = await readJson(req)
      const email = String(b.email || '').trim().toLowerCase()
      if (!isEmail(email)) return send(400, { ok: false, error: 'Please enter a valid email address' })
      const attribution = b.attribution && typeof b.attribution === 'object'
        ? Object.fromEntries(Object.entries(b.attribution).slice(0, 12).map(([k, v]) => [clean(k, 40), clean(String(v), 200)]))
        : null
      const user = await store.upsertUser({ email, name: clean(b.name, 80) || '', marketing: !!b.marketing, attribution })
      if (b.marketing) addToSignupsSheet({ email, name: user.name, source: 'app', ...(attribution || {}) })
      return send(200, { ok: true, user: { email: user.email, name: user.name, plan: user.plan } })
    }

    // POST /api/events — funnel tracking
    if (p === '/api/events' && req.method === 'POST') {
      const b = await readJson(req)
      if (!EVENTS.has(b.event)) return send(400, { ok: false, error: 'Unknown event' })
      const raw = b.props && typeof b.props === 'object' ? JSON.stringify(b.props) : null
      const props = raw ? (raw.length <= 2000 ? JSON.parse(raw) : { truncated: true }) : null
      await store.addEvent({ event: b.event, anonId: clean(b.anonId, 64), email: isEmail(b.email) ? b.email.toLowerCase() : null, board: clean(b.board, 12), props })
      return send(200, { ok: true })
    }

    // GET /api/entitlement?board=&email=  ·  POST to claim ownership of a new board
    if (p === '/api/entitlement') {
      if (req.method === 'POST') {
        const b = await readJson(req)
        const email = String(b.email || '').toLowerCase()
        if (b.board && isEmail(email)) await store.setBoardPlan(clean(b.board, 12), { owner: email })
        return send(200, { ok: true, ...(await entitlement(clean(b.board, 12), email)) })
      }
      const email = (url.searchParams.get('email') || '').toLowerCase()
      return send(200, { ok: true, ...(await entitlement(clean(url.searchParams.get('board'), 12), email)) })
    }

    // POST /api/checkout — start payment (demo: unlock now)
    if (p === '/api/checkout' && req.method === 'POST') {
      const b = await readJson(req)
      const email = String(b.email || '').toLowerCase(), board = clean(b.board, 12), plan = b.plan
      if (!isEmail(email) || !board || plan !== 'ten') return send(400, { ok: false, error: 'Missing details' })
      if (!stripeEnabled()) {
        await grant(board, email, plan)
        return send(200, { ok: true, demo: true, ...(await entitlement(board, email)) })
      }
      const origin = clean(b.returnUrl, 500) || process.env.APP_URL || 'http://localhost:3000'
      const session = await stripe('POST', 'checkout/sessions', {
        mode: 'payment',
        'line_items[0][price]': process.env.STRIPE_PRICE_TEN,
        'line_items[0][quantity]': '1',
        customer_email: email,
        'metadata[board]': board, 'metadata[email]': email, 'metadata[plan]': plan,
        success_url: `${origin}?board=${board}&checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}?board=${board}&checkout=cancelled`,
      })
      return send(200, { ok: true, url: session.url })
    }

    // GET /api/checkout/verify?session_id= — confirm a Stripe payment on return
    if (p === '/api/checkout/verify' && req.method === 'GET') {
      if (!stripeEnabled()) return send(400, { ok: false, error: 'Stripe not configured' })
      const id = url.searchParams.get('session_id') || ''
      if (!/^cs_[A-Za-z0-9_]+$/.test(id)) return send(400, { ok: false, error: 'Bad session' })
      const s = await stripe('GET', `checkout/sessions/${id}`)
      if (s.payment_status !== 'paid') return send(200, { ok: false, status: s.payment_status })
      const { board, email, plan } = s.metadata || {}
      const current = await entitlement(board, email)
      if (current.plan !== plan && current.plan !== 'unlimited') await grant(board, email, plan)
      return send(200, { ok: true, ...(await entitlement(board, email)) })
    }

    // GET /api/admin/funnel · /api/admin/users — needs ADMIN_TOKEN
    if (p.startsWith('/api/admin/')) {
      // Trim both sides: tokens pasted into Railway or a link often pick up a stray space or newline.
      // A '+' in a link arrives as a space, so put it back.
      const token = (process.env.ADMIN_TOKEN || '').trim()
      // Header for scripts; ?token= so the CSV can be a browser bookmark
      const given = ((req.headers.authorization || '').replace(/^Bearer /, '') || (url.searchParams.get('token') || '').trim().replace(/ /g, '+')).trim()
      if (!token) return send(503, { ok: false, error: 'ADMIN_TOKEN is not set on this server' })
      if (given.length !== token.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(token))) return send(401, { ok: false, error: 'Unauthorised' })
      if (p === '/api/admin/funnel') return send(200, { ok: true, ...(await store.funnel()) })
      if (p === '/api/admin/users') return send(200, { ok: true, users: await store.users() })
      if (p === '/api/admin/users.csv') {
        const rows = (await store.users()).map(u => {
          const a = u.attribution || {}
          return [u.created_at || u.createdAt || '', u.email, u.name, u.marketing ? 'yes' : 'no', u.plan, a.source, a.searching, a.utm_source, a.utm_campaign]
        })
        res.setHeader('Content-Type', 'text/csv; charset=utf-8')
        res.setHeader('Content-Disposition', 'attachment; filename="homeswoon-users.csv"')
        res.end([['created', 'email', 'name', 'updates', 'plan', 'source', 'searching', 'utm_source', 'utm_campaign'], ...rows].map(r => r.map(csvCell).join(',')).join('\n'))
        return true
      }
    }

    return send(404, { ok: false, error: 'Not found' })
  } catch (err) {
    return send(500, { ok: false, error: err.message })
  }
}
