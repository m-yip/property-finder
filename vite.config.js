import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fetchPropertyData } from './scraper.js'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'property-scraper',
      configureServer(server) {
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
