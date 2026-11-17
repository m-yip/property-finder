import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The API code (scraper, accounts, database) is only loaded by the local dev server,
// never during `vite build`, so building on Railway doesn't try to reach the database.

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'property-scraper',
      async configureServer(server) {
        const { fetchPropertyData, checkListingStatus } = await import('./scraper.js')
        const { handleBillingApi } = await import('./billing.js')
        // Accounts, funnel events, plans & checkout (JSON-file store in dev)
        server.middlewares.use(async (req, res, next) => {
          if (!(await handleBillingApi(req, res))) next()
        })
        // Listing availability (has the agent taken it down?)
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith('/api/listing-status')) return next()
          const target = new URLSearchParams(req.url.split('?')[1] || '').get('url')
          res.setHeader('Content-Type', 'application/json')
          if (!target) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'Missing url parameter' })) }
          res.end(JSON.stringify({ ok: true, ...(await checkListingStatus(target)) }))
        })
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith('/api/scrape')) return next()

          const qs        = req.url.split('?')[1] || ''
          const targetUrl = new URLSearchParams(qs).get('url')

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
        })
      },
    },
  ],
})
