import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ── Property scraper helpers ──────────────────────────────────────────────────

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Accept-Encoding': 'identity',
  'Cache-Control': 'no-cache',
}

// ── Headless Chrome fallback (for Cloudflare-protected sites like Zoopla) ─────

const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
]

async function findChrome() {
  const { existsSync } = await import('fs')
  for (const p of CHROME_PATHS) {
    if (existsSync(p)) return p
  }
  return null
}

async function fetchWithPuppeteer(url) {
  const chromePath = await findChrome()
  if (!chromePath) throw new Error('Chrome not found for headless fetch')
  const { default: puppeteer } = await import('puppeteer-core')
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
  })
  try {
    const page = await browser.newPage()
    await page.setUserAgent(FETCH_HEADERS['User-Agent'])
    await page.setViewport({ width: 1440, height: 900 })
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false })
    })
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
    // Wait for Cloudflare JS challenge to resolve if still active
    let html = await page.content()
    if (/Just a moment|cf-browser-verification|cf_chl_prog/i.test(html)) {
      await new Promise(r => setTimeout(r, 5000))
      html = await page.content()
    }
    return html
  } finally {
    await browser.close()
  }
}

async function fetchPropertyData(url) {
  const resp = await fetch(url, { headers: FETCH_HEADERS, redirect: 'follow' }).catch(() => null)
  let html
  if (resp?.ok) {
    html = await resp.text()
  } else if (!resp || resp.status === 403 || resp.status === 503) {
    // Cloudflare or similar block — try headless Chrome
    html = await fetchWithPuppeteer(url)
  } else {
    throw new Error(`HTTP ${resp.status}`)
  }

  const host = new URL(url).hostname
  let result = {}

  // Site-specific parsers for the big portals and major direct agencies
  if (host.includes('rightmove')) result = parseRightmove(html)
  else if (host.includes('zoopla')) result = parseZoopla(html)
  else if (host.includes('onthemarket')) result = parseOnTheMarket(html)
  else if (host.includes('foxtons')) result = parseFoxtons(html)
  else if (host.includes('chestertons')) result = parseChestertons(html)
  else if (host.includes('dexters')) result = parseDexters(html)
  else if (host.includes('savills')) result = parseSavills(html)
  else if (host.includes('knightfrank')) result = parseKnightFrank(html)

  // Generic parser always runs and fills any gaps (works for every site)
  const gen = parseGeneric(html, url)
  result = fillMissing(result, gen)

  return result
}

// Merge: primary wins for non-empty values; fallback fills gaps
function fillMissing(primary, fallback) {
  const r = { ...primary }
  for (const [k, v] of Object.entries(fallback)) {
    const cur = r[k]
    if (v != null && v !== '' && v !== 0 && (cur == null || cur === '' || cur === 0)) {
      r[k] = v
    }
  }
  return r
}

// ── Rightmove ─────────────────────────────────────────────────────────────────

function parseRightmove(html) {
  let result = null

  // Strategy 1: window.PAGE_MODEL
  const pm = tryExtractPageModel(html)
  if (pm) {
    const pd = pm.propertyData || pm
    if (pd && pd.address) result = fromRightmovePd(pd)
  }

  // Strategy 2: __NEXT_DATA__
  if (!result) {
    const nd = tryExtractNextData(html)
    if (nd) {
      const pd = deepFind(nd, 'propertyData') || deepFind(nd, 'propertyDetails')
      if (pd) result = fromRightmovePd(pd)
    }
  }

  if (!result) return parseGeneric(html)

  // Final fallbacks — scan raw HTML for anything still missing
  if (!result.sqft)         result.sqft         = extractSqftFromHtml(html)
  if (!result.serviceCharge) result.serviceCharge = extractHtmlCharge(html, 'service.charge|management.charge')
  if (result.groundRent == null) {
    const gr = extractHtmlCharge(html, 'ground.rent')
    if (gr != null) result.groundRent = gr
    else if (/peppercorn|nil\s+ground|zero\s+ground/i.test(html)) result.groundRent = 0
  }
  if (!result.leaseLength) result.leaseLength = extractLeaseFromText(html)
  if (!result.estateAgent) result.estateAgent = extractAgentFromHtml(html)
  if (!result.agentContact) result.agentContact = extractPhoneFromHtml(html)

  return result
}

function tryExtractPageModel(html) {
  const marker = 'window.PAGE_MODEL = '
  const idx = html.indexOf(marker)
  if (idx === -1) return null
  const after = html.slice(idx + marker.length).trimStart()

  // Case: JSON.parse("…")
  if (after.startsWith('JSON.parse(')) {
    const inner = after.slice(11)
    const q = inner[0]
    if (q === '"' || q === "'") {
      let i = 1, escaped = false
      while (i < inner.length) {
        if (escaped) { escaped = false; i++; continue }
        if (inner[i] === '\\') { escaped = true; i++; continue }
        if (inner[i] === q) break
        i++
      }
      try { return JSON.parse(JSON.parse(`"${inner.slice(1, i)}"`)) } catch {}
    }
  }

  // Case: direct object
  if (after.startsWith('{')) {
    const json = extractBalancedJson(after, 0)
    if (json) { try { return JSON.parse(json) } catch {} }
  }
  return null
}

function fromRightmovePd(pd) {
  const r = {}
  r.address = pd.address?.displayAddress || pd.address || ''

  const priceStr = pd.prices?.primaryPrice || pd.price?.amount || ''
  Object.assign(r, parsePriceString(priceStr))
  if (!r.priceType) r.priceType = pd.channel === 'LETTINGS' ? 'rent' : 'buy'

  r.bedrooms = toNum(pd.bedrooms ?? pd.beds ?? pd.bedroomCount)
  r.bathrooms = toNum(pd.bathrooms ?? pd.baths ?? pd.bathroomCount)

  // Sqft — try multiple paths, convert sqm where needed
  r.sqft = extractSqftFromPd(pd)

  // Estate agent — try every known path
  r.estateAgent = pd.customer?.brandTradingName
    || pd.customer?.customerBranchDisplayName
    || pd.customer?.displayName
    || pd.branch?.name
    || pd.agent?.name
    || ''
  r.agentContact = pd.customer?.contactTelephone
    || pd.customer?.telephoneNumbers?.[0]?.value
    || pd.contactInfo?.telephoneNumbers?.[0]?.value
    || ''
  r.epcRating = pd.epc?.rating || ''

  // Images
  const imgs = pd.images || pd.propertyImages?.images || []
  if (imgs.length > 0) {
    const img = imgs[0]
    let rawUrl = img?.url || img?.srcUrl || img?.src || (typeof img === 'string' ? img : '')
    rawUrl = rawUrl.replace(/_max_\d+x\d+/, '_max_800x600')
    r.imageUrl = rawUrl
  }

  // ── Tenure / financial charges ─────────────────────────────────────────────
  // Priority 1: dedicated tenure object in PAGE_MODEL
  const tenure = pd.tenure || pd.lettingInformation?.tenure || null
  if (tenure) {
    if (tenure.yearsRemainingOnLease) {
      r.leaseLength = `${tenure.yearsRemainingOnLease} years remaining`
    } else if (tenure.leaseExpiryYear) {
      const rem = tenure.leaseExpiryYear - new Date().getFullYear()
      if (rem > 0) r.leaseLength = `${rem} years remaining`
    }
    const sc = tenure.annualServiceCharge ?? tenure.serviceCharge ?? tenure.serviceCost
    if (sc) r.serviceCharge = toNum(sc)
    const gr = tenure.annualGroundRent ?? tenure.groundRent
    if (gr != null) r.groundRent = toNum(gr)
  }

  // Priority 2: livingCosts object
  if (!r.serviceCharge && pd.livingCosts) {
    const lc = pd.livingCosts
    const sc = lc.annualServiceCharge ?? lc.serviceCharge ?? lc.managementCharge
    if (sc) r.serviceCharge = toNum(sc)
    const gr = lc.annualGroundRent ?? lc.groundRent
    if (gr != null) r.groundRent = toNum(gr)
  }

  // ── Key features + description text parsing ───────────────────────────────
  const featsArr = pd.keyFeatures || pd.features || []
  const descText = pd.text?.description || pd.summary || ''
  const fullText = [...featsArr, descText].join(' ')
  const feats = fullText.toLowerCase()

  // Floor
  const floorM = fullText.match(
    /\b(lower\s+ground|basement|ground|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|\d+(?:st|nd|rd|th))\s+floor\b/i
  )
  if (floorM) r.floor = capitalise(floorM[0].trim())

  // Outdoor space
  if (feats.includes('garden')) r.outdoorSpaceType = 'garden'
  else if (feats.includes('terrace') || feats.includes('roof terrace')) r.outdoorSpaceType = 'terrace'
  else if (feats.includes('balcony')) r.outdoorSpaceType = 'balcony'
  else if (feats.includes('juliet')) r.outdoorSpaceType = 'juliet'

  // Parking
  if (feats.includes('parking') || feats.includes('garage') || feats.includes('allocated space')) r.hasParking = true

  // Service charge from text (if not already found in tenure/livingCosts)
  if (!r.serviceCharge) {
    r.serviceCharge = extractChargeFromText(fullText, [
      /service\s+charge[^£\d]{0,40}£\s*([\d,]+)/i,
      /annual\s+service\s+charge[^£\d]{0,20}£\s*([\d,]+)/i,
      /maintenance\s+charge[^£\d]{0,20}£\s*([\d,]+)/i,
      /£\s*([\d,]+)\s*(?:per\s+annum|pa|p\.a\.)[^.]{0,40}service\s+charge/i,
    ])
  }

  // Ground rent from text
  if (r.groundRent == null) {
    if (/peppercorn|nil\s+ground|zero\s+ground|no\s+ground\s+rent/i.test(fullText)) {
      r.groundRent = 0
    } else {
      r.groundRent = extractChargeFromText(fullText, [
        /ground\s+rent[^£\d]{0,40}£\s*([\d,]+)/i,
        /annual\s+ground\s+rent[^£\d]{0,20}£\s*([\d,]+)/i,
        /£\s*([\d,]+)\s*(?:per\s+annum|pa)[^.]{0,40}ground\s+rent/i,
      ])
    }
  }

  // Lease length from text
  if (!r.leaseLength) {
    r.leaseLength = extractLeaseFromText(fullText)
  }

  r.description = pd.text?.description || pd.summary || ''

  return r
}

// ── Zoopla ───────────────────────────────────────────────────────────────────

function parseZoopla(html) {
  // Attempt 1: __NEXT_DATA__ (older Zoopla pages)
  const nd = tryExtractNextData(html)
  if (nd) {
    const listing = deepFind(nd, 'listing') || deepFind(nd, 'property')
    if (listing) {
      const result = fromZooplaListing(listing)
      if (!result.sqft)              result.sqft          = extractSqftFromHtml(html)
      if (!result.serviceCharge)     result.serviceCharge = extractHtmlCharge(html, 'service.charge|management.charge')
      if (result.groundRent == null) {
        const gr = extractHtmlCharge(html, 'ground.rent')
        if (gr != null) result.groundRent = gr
      }
      if (!result.leaseLength)  result.leaseLength  = extractLeaseFromText(html)
      if (!result.estateAgent)  result.estateAgent  = extractAgentFromHtml(html)
      if (!result.agentContact) result.agentContact = extractPhoneFromHtml(html)
      return result
    }
  }

  // Attempt 2: modern Zoopla (Next.js App Router — JSON-LD + embedded analytics JSON)
  const r = {}

  // Address: og:title is "Address, N bed type for sale, £xxx - Zoopla" — strip the suffix
  const ogTitle = getMeta(html, 'og:title')
  if (ogTitle) {
    r.address = ogTitle
      .replace(/\s*-\s*Zoopla.*$/i, '')       // strip " - Zoopla" and anything after
      .replace(/,\s*\d+\s*bed.*$/i, '')        // strip ", 2 bed flat for sale, £350,000"
      .trim()
  }

  // Price, bedrooms, bathrooms, image from JSON-LD RealEstateListing
  for (const ld of getJsonLdBlocks(html)) {
    if (ld['@type'] !== 'RealEstateListing') continue
    if (ld.offers) {
      r.price = toNum(ld.offers.price || ld.offers.lowPrice)
      r.priceType = 'buy'
    }
    if (ld.image) r.imageUrl = typeof ld.image === 'string' ? ld.image : ld.image?.url || (Array.isArray(ld.image) ? ld.image[0] : '') || ''
    if (Array.isArray(ld.additionalProperty)) {
      for (const ap of ld.additionalProperty) {
        if (/bedroom/i.test(ap.name)) r.bedrooms = toNum(ap.value)
        if (/bathroom/i.test(ap.name)) r.bathrooms = toNum(ap.value)
      }
    }
    break
  }

  // Detect rent/sale from analytics section key
  const sectionM = html.match(/"section"\s*:\s*"(for-sale|to-rent)"/)
  if (sectionM) r.priceType = sectionM[1] === 'to-rent' ? 'rent' : 'buy'

  // Agent: "branch_name" is reliably in analytics JSON and page data
  const branchM = html.match(/"branch_name"\s*:\s*"([^"]+)"/)
  if (branchM) r.estateAgent = branchM[1]

  // Tenure from analytics JSON
  const tenureM = html.match(/"tenure"\s*:\s*"(leasehold|freehold|share[^"]{0,30}freehold)"/i)
  if (tenureM) r.tenure = capitalise(tenureM[1])

  // Floor area from analytics JSON "size_sq_feet"
  const sqftM = html.match(/"size_sq_feet"\s*:\s*"(\d+)"/)
  if (sqftM && parseInt(sqftM[1]) > 0) r.sqft = parseInt(sqftM[1])
  if (!r.sqft) r.sqft = extractSqftFromHtml(html)

  // Full description from the dedicated paragraph id="detailed-desc"
  const descM = html.match(/<p[^>]*id="detailed-desc"[^>]*>([\s\S]*?)<\/p>/i)
  if (descM) r.description = descM[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

  // Lease, charges, phone
  r.leaseLength  = extractLeaseFromText(html) || ''
  r.serviceCharge = extractHtmlCharge(html, 'service.charge|management.charge')
  const gr = extractHtmlCharge(html, 'ground.rent')
  if (gr != null) r.groundRent = gr
  if (r.groundRent == null && /peppercorn/i.test(html)) r.groundRent = 0
  r.agentContact = extractPhoneFromHtml(html)

  return r
}

function fromZooplaListing(l) {
  const r = {}
  r.address = l.displayAddress || l.address?.displayAddress || ''
  Object.assign(r, parsePriceString(String(l.price || l.rentPrice || l.purchasePrice || '')))
  if (!r.priceType) r.priceType = (l.listingType || '').toLowerCase().includes('rent') ? 'rent' : 'buy'
  r.bedrooms = toNum(l.numBedrooms ?? l.bedrooms)
  r.bathrooms = toNum(l.numBathrooms ?? l.bathrooms)

  // Sqft with m² conversion
  if (l.floorArea) {
    const val = toNum(l.floorArea.value ?? l.floorArea)
    const unit = (l.floorArea.unit || '').toLowerCase()
    r.sqft = unit.startsWith('sq') && unit.includes('m') ? Math.round(val * 10.764) : val
  }
  if (!r.sqft) r.sqft = toNum(l.sqft)

  r.estateAgent = l.branch?.name || l.branch?.brandName || l.agent?.name || l.agencyName || ''
  r.agentContact = l.branch?.phone || l.branch?.telephone || l.agent?.phone || ''

  // Service charge / ground rent / lease from Zoopla data
  if (l.leaseRemaining || l.leaseLength) r.leaseLength = `${l.leaseRemaining || l.leaseLength} years remaining`
  if (l.serviceCharge || l.annualServiceCharge) r.serviceCharge = toNum(l.serviceCharge ?? l.annualServiceCharge)
  if (l.groundRent != null) r.groundRent = toNum(l.groundRent)

  // Floor from description/features
  const desc = l.description || l.shortDescription || ''
  const feats = (l.features || []).join(' ')
  const fullText = [feats, desc].join(' ')
  const floorM = fullText.match(
    /\b(lower\s+ground|basement|ground|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|\d+(?:st|nd|rd|th))\s+floor\b/i
  )
  if (floorM) r.floor = capitalise(floorM[0].trim())

  const imgs = l.images || l.photos || []
  if (imgs.length > 0) {
    const img = imgs[0]
    r.imageUrl = img?.url || img?.src || (typeof img === 'string' ? img : '')
  }
  r.description = l.description || l.shortDescription || ''
  return r
}

// ── OnTheMarket ───────────────────────────────────────────────────────────────

function parseOnTheMarket(html) {
  const nd = tryExtractNextData(html)
  if (nd) {
    const prop = deepFind(nd, 'property') || deepFind(nd, 'listing')
    if (prop) {
      const r = {}
      r.address = prop.address?.displayAddress || prop.displayAddress || prop.address || ''
      Object.assign(r, parsePriceString(String(prop.price || prop.displayPrice || '')))
      r.bedrooms = toNum(prop.bedrooms)
      r.bathrooms = toNum(prop.bathrooms)
      r.estateAgent = prop.agent?.name || prop.branch?.name || ''
      const imgs = prop.images || prop.photos || []
      if (imgs.length > 0) {
        const img = imgs[0]
        r.imageUrl = img?.url || img?.src || (typeof img === 'string' ? img : '')
      }
      r.description = prop.description || prop.shortDescription || prop.propertyDescription || ''
      return r
    }
  }
  return parseGeneric(html)
}

// ── Foxtons ───────────────────────────────────────────────────────────────────

function parseFoxtons(html) {
  const nd = tryExtractNextData(html)
  if (!nd) return parseGeneric(html)

  // Foxtons NEXT_DATA: props.pageProps.property or props.pageProps.data.property
  let prop = deepFind(nd, 'property') || deepFind(nd, 'listing')
  if (!prop || typeof prop !== 'object') return parseGeneric(html)

  const r = {}
  // Address — Foxtons uses displayAddress or address string
  r.address = prop.displayAddress || prop.address?.displayAddress || prop.address
    || [prop.address?.line1, prop.address?.line2, prop.address?.postCode].filter(Boolean).join(', ') || ''
  if (typeof r.address !== 'string') r.address = ''

  // Price — Foxtons formats price as number or "£1,500,000"
  const rawPrice = prop.price || prop.askingPrice || prop.marketValue || prop.displayPrice
  if (rawPrice) {
    const ps = parsePriceString(String(rawPrice))
    Object.assign(r, ps)
  }
  if (!r.priceType) r.priceType = (prop.channel || prop.listingType || '').toLowerCase().includes('let') ? 'rent' : 'buy'

  r.bedrooms = toNum(prop.bedrooms || prop.numberOfBedrooms)
  r.bathrooms = toNum(prop.bathrooms || prop.numberOfBathrooms)
  r.estateAgent = 'Foxtons'
  r.agentContact = prop.branch?.telephone || prop.branch?.phone || prop.contactPhone || ''

  // Floor area
  const fa = prop.floorArea || prop.size || prop.sqft
  if (fa) {
    const val = toNum(typeof fa === 'object' ? (fa.value ?? fa.sqFeet ?? fa.sqMetres) : fa)
    const unit = (typeof fa === 'object' ? fa.unit || '' : '').toLowerCase()
    r.sqft = unit.includes('m') && !unit.includes('sqf') ? Math.round(val * 10.764) : val
  }
  if (!r.sqft) r.sqft = extractSqftFromHtml(html)

  // Images
  const imgs = prop.images || prop.photos || prop.media || []
  if (Array.isArray(imgs) && imgs.length > 0) {
    const img = imgs[0]
    r.imageUrl = typeof img === 'string' ? img : img?.url || img?.src || img?.mediaUrl || ''
  }

  r.description = prop.description || prop.fullDescription || prop.longDescription || prop.marketingDescription || ''
  r.tenure = prop.tenure || prop.tenureType || ''
  if (r.tenure) r.tenure = r.tenure.charAt(0).toUpperCase() + r.tenure.slice(1).toLowerCase()

  const ll = prop.leaseLength || prop.leaseRemaining || prop.yearsRemainingOnLease
  if (ll) r.leaseLength = `${ll} years remaining`
  if (!r.leaseLength) r.leaseLength = extractLeaseFromText(r.description || '')
  if (!r.leaseLength) r.leaseLength = extractLeaseFromText(html)

  const sc = prop.serviceCharge || prop.annualServiceCharge
  if (sc) r.serviceCharge = toNum(sc)
  if (!r.serviceCharge) r.serviceCharge = extractHtmlCharge(html, 'service.charge|management.charge')
  const gr = prop.groundRent || prop.annualGroundRent
  if (gr != null) r.groundRent = toNum(gr)

  return r
}

// ── Chestertons ───────────────────────────────────────────────────────────────

function parseChestertons(html) {
  const nd = tryExtractNextData(html)
  if (!nd) return parseGeneric(html)

  let prop = deepFind(nd, 'property') || deepFind(nd, 'listing') || deepFind(nd, 'propertyDetails')
  if (!prop || typeof prop !== 'object') return parseGeneric(html)

  const r = {}

  // Address — Chestertons uses address object or displayAddress
  const addr = prop.address || {}
  r.address = prop.displayAddress || prop.fullAddress
    || [addr.street || addr.line1, addr.area || addr.line2, addr.postcode || addr.postalCode].filter(Boolean).join(', ')
    || (typeof addr === 'string' ? addr : '') || ''

  // Price — Chestertons uses guidePrice, askingPrice, or price
  const rawPrice = prop.guidePrice || prop.askingPrice || prop.price || prop.salePrice || prop.rentalPrice
  if (rawPrice) Object.assign(r, parsePriceString(String(rawPrice)))
  if (!r.priceType) r.priceType = (prop.listingType || prop.channel || '').toLowerCase().includes('let') ? 'rent' : 'buy'

  r.bedrooms = toNum(prop.bedrooms || prop.numberOfBedrooms || prop.numBedrooms)
  r.bathrooms = toNum(prop.bathrooms || prop.numberOfBathrooms || prop.numBathrooms)
  r.estateAgent = 'Chestertons'
  r.agentContact = prop.branch?.telephone || prop.branch?.phone || prop.contactTelephone || prop.agentPhone || ''

  // Floor area — Chestertons may use grossInternalArea or floorArea
  const fa = prop.floorArea || prop.grossInternalArea || prop.internalArea || prop.size || prop.sqft
  if (fa) {
    const val = toNum(typeof fa === 'object' ? (fa.value ?? fa.sqFeet ?? fa.sqMetres) : fa)
    const unit = (typeof fa === 'object' ? fa.unit || fa.unitText || '' : '').toLowerCase()
    r.sqft = unit.includes('m') && !unit.includes('sqf') ? Math.round(val * 10.764) : val
  }
  if (!r.sqft) r.sqft = extractSqftFromHtml(html)

  // Images
  const imgs = prop.images || prop.photos || prop.media || prop.floorPlans || []
  const mainImgs = imgs.filter ? imgs.filter(i => !i?.type?.toLowerCase().includes('floor')) : imgs
  if (Array.isArray(mainImgs) && mainImgs.length > 0) {
    const img = mainImgs[0]
    r.imageUrl = typeof img === 'string' ? img : img?.url || img?.src || img?.mediaUrl || img?.originalUrl || ''
  }

  r.description = prop.description || prop.fullDescription || prop.propertyDescription
    || prop.marketingDescription || prop.longDescription || ''
  r.tenure = prop.tenure || prop.tenureType || ''
  if (r.tenure) r.tenure = r.tenure.charAt(0).toUpperCase() + r.tenure.slice(1).toLowerCase()

  const ll = prop.leaseLength || prop.leaseRemaining || prop.yearsRemainingOnLease || prop.remainingYears
  if (ll) r.leaseLength = `${ll} years remaining`
  if (!r.leaseLength) r.leaseLength = extractLeaseFromText(r.description || '')
  if (!r.leaseLength) r.leaseLength = extractLeaseFromText(html)

  const sc = prop.serviceCharge || prop.annualServiceCharge || prop.maintenanceCharge
  if (sc) r.serviceCharge = toNum(sc)
  if (!r.serviceCharge) r.serviceCharge = extractHtmlCharge(html, 'service.charge|management.charge')
  const gr = prop.groundRent || prop.annualGroundRent
  if (gr != null) r.groundRent = toNum(gr)
  if (r.groundRent == null && /peppercorn/i.test(r.tenure || r.description || '')) r.groundRent = 0

  return r
}

// ── Dexters ───────────────────────────────────────────────────────────────────

function parseDexters(html) {
  return parseAgencyNextData(html, 'Dexters')
}

// ── Savills ───────────────────────────────────────────────────────────────────

function parseSavills(html) {
  return parseAgencyNextData(html, 'Savills')
}

// ── Knight Frank ──────────────────────────────────────────────────────────────

function parseKnightFrank(html) {
  return parseAgencyNextData(html, 'Knight Frank')
}

// ── Generic agency NEXT_DATA parser (shared by Dexters, Savills, Knight Frank, etc.) ──
function parseAgencyNextData(html, agencyName) {
  const nd = tryExtractNextData(html)
  if (!nd) return parseGeneric(html)

  let prop = null
  const propKeys = ['property', 'listing', 'propertyDetails', 'propertyDetail', 'listingDetails', 'result', 'data']
  for (const k of propKeys) {
    const candidate = deepFind(nd, k)
    if (candidate && typeof candidate === 'object' && (candidate.address || candidate.price || candidate.bedrooms || candidate.description)) {
      prop = candidate
      break
    }
  }
  if (!prop) return parseGeneric(html)

  const r = {}
  const addr = prop.address || {}
  r.address = prop.displayAddress || prop.fullAddress || prop.address?.displayAddress
    || [addr.street || addr.line1 || addr.streetAddress, addr.area || addr.locality, addr.postcode || addr.postalCode].filter(Boolean).join(', ')
    || (typeof addr === 'string' ? addr : '') || prop.title || ''

  const rawPrice = prop.price || prop.displayPrice || prop.askingPrice || prop.guidePrice || prop.salePrice || prop.rentPrice
  if (rawPrice) Object.assign(r, parsePriceString(String(rawPrice)))
  if (!r.priceType) r.priceType = (prop.channel || prop.listingType || '').toLowerCase().includes('let') ? 'rent' : 'buy'

  r.bedrooms = toNum(prop.bedrooms || prop.numberOfBedrooms || prop.numBedrooms)
  r.bathrooms = toNum(prop.bathrooms || prop.numberOfBathrooms || prop.numBathrooms)
  r.estateAgent = agencyName

  const imgs = prop.images || prop.photos || prop.media || []
  const mainImgs = Array.isArray(imgs) ? imgs.filter(i => !String(i?.type || '').toLowerCase().includes('floor')) : []
  if (mainImgs.length > 0) {
    const img = mainImgs[0]
    r.imageUrl = typeof img === 'string' ? img : img?.url || img?.src || img?.mediaUrl || ''
  }

  r.description = prop.description || prop.fullDescription || prop.longDescription
    || prop.propertyDescription || prop.marketingDescription || ''
  r.tenure = prop.tenure || prop.tenureType || ''
  if (r.tenure) r.tenure = r.tenure.charAt(0).toUpperCase() + r.tenure.slice(1).toLowerCase()
  r.leaseLength = extractLeaseFromText(r.description || '') || extractLeaseFromText(html)
  r.serviceCharge = extractHtmlCharge(html, 'service.charge|management.charge')
  const gr = extractHtmlCharge(html, 'ground.rent')
  if (gr != null) r.groundRent = gr
  r.agentContact = extractPhoneFromHtml(html)
  r.sqft = extractSqftFromHtml(html)

  return r
}

// ── Generic fallback (all estate agent sites) ─────────────────────────────────

// Domain → known agency name (covers direct estate agent websites)
const KNOWN_AGENCIES = {
  'foxtons.co.uk': 'Foxtons',
  'chestertons.com': 'Chestertons',
  'savills.com': 'Savills',
  'savills.co.uk': 'Savills',
  'knightfrank.co.uk': 'Knight Frank',
  'knightfrank.com': 'Knight Frank',
  'hamptons.co.uk': 'Hamptons',
  'dexters.co.uk': 'Dexters',
  'marshandparsons.co.uk': 'Marsh & Parsons',
  'winkworth.co.uk': 'Winkworth',
  'fineandcountry.com': 'Fine & Country',
  'jll.co.uk': 'JLL',
  'colliers.com': 'Colliers',
  'cbre.co.uk': 'CBRE',
  'haart.co.uk': 'haart',
  'purplebricks.co.uk': 'Purplebricks',
  'yopa.co.uk': 'Yopa',
  'openrent.co.uk': 'OpenRent',
  'chancellors.co.uk': 'Chancellors',
  'struttandparker.com': 'Strutt & Parker',
  'bairstoweves.co.uk': 'Bairstow Eves',
  'connells.co.uk': 'Connells',
  'countrywide.co.uk': 'Countrywide',
  'martinco.com': 'Martin & Co',
  'kayandco.co.uk': 'Kay & Co',
  'northfields.co.uk': 'Northfields',
  'stow-brothers.co.uk': 'Stow Brothers',
  'aylesford.com': 'Aylesford International',
  'glentree.co.uk': 'Glentree',
  'spicerhaart.co.uk': 'Spicerhaart',
  'elliscampbell.co.uk': 'Ellis Campbell',
  'ayrtons.co.uk': 'Ayrtons',
  'anthonywebb.co.uk': 'Anthony Webb',
  'beresfords.co.uk': 'Beresfords',
}

// "foxtons.co.uk" → "Foxtons" (generic fallback for unknown domains)
function titleCaseFromDomain(host) {
  const base = host.replace(/^www\./, '').split('.')[0]
  return base.charAt(0).toUpperCase() + base.slice(1)
}

// Extract Google Tag Manager / Analytics dataLayer pushes
function extractDataLayer(html) {
  const r = {}
  const re = /dataLayer\.push\(\s*(\{[\s\S]+?\})\s*\)/g
  let m
  while ((m = re.exec(html)) !== null) {
    let obj
    try { obj = JSON.parse(m[1]) } catch { continue }
    if (!r.price) {
      const raw = obj.price || obj.propertyPrice || obj.listingPrice || obj.salePrice || obj.rentalPrice
      if (raw) {
        const parsed = parsePriceString(String(raw))
        if (parsed.price) Object.assign(r, parsed)
      }
    }
    if (!r.bedrooms) r.bedrooms = toNum(obj.bedrooms || obj.numberOfBedrooms || obj.beds)
    if (!r.bathrooms) r.bathrooms = toNum(obj.bathrooms || obj.numberOfBathrooms || obj.baths)
    if (!r.address) r.address = obj.address || obj.propertyAddress || ''
    if (!r.estateAgent) r.estateAgent = obj.agencyName || obj.agentName || obj.brandName || obj.company || ''
  }
  // Also check dataLayer = [{...}] initialisation
  const init = html.match(/dataLayer\s*=\s*\[(\{[\s\S]+?\})\]/)
  if (init) {
    try {
      const obj = JSON.parse(init[1])
      if (!r.price) {
        const raw = obj.price || obj.propertyPrice
        if (raw) {
          const parsed = parsePriceString(String(raw))
          if (parsed.price) Object.assign(r, parsed)
        }
      }
      if (!r.bedrooms) r.bedrooms = toNum(obj.bedrooms || obj.beds)
      if (!r.estateAgent) r.estateAgent = obj.agencyName || obj.brandName || ''
    } catch {}
  }
  return r
}

function parseGeneric(html, url) {
  const r = {}
  const host = url ? new URL(url).hostname.replace(/^www\./, '') : ''

  // ── Strategy 1: Agency name from known domain map or og:site_name ─────────
  r.estateAgent = KNOWN_AGENCIES[host] || ''
  if (!r.estateAgent) {
    const siteName = getMeta(html, 'og:site_name')
    if (siteName && siteName.length < 60 && !/rightmove|zoopla|onthemarket|primelocation/i.test(siteName)) {
      r.estateAgent = siteName
    }
  }
  // Last resort: derive from domain name
  if (!r.estateAgent && host && !/rightmove|zoopla|onthemarket/i.test(host)) {
    r.estateAgent = titleCaseFromDomain(host)
  }

  // ── Strategy 2: OG / twitter meta tags ────────────────────────────────────
  r.imageUrl = getMeta(html, 'og:image') || getMeta(html, 'twitter:image') || ''
  const ogTitle = getMeta(html, 'og:title') || ''

  // ── Strategy 3: JSON-LD (broader type matching + agent from seller/provider) ─
  const ldBlocks = getJsonLdBlocks(html)
  const PROPERTY_TYPES = new Set(['RealEstateListing', 'SingleFamilyResidence', 'Apartment', 'House', 'Accommodation', 'Residence', 'LodgingBusiness'])
  for (const ld of ldBlocks) {
    const types = [].concat(ld['@type'] || [])
    if (!types.some(t => PROPERTY_TYPES.has(t))) continue

    if (!r.address) {
      const a = ld.address
      if (a) r.address = typeof a === 'string' ? a : [a.streetAddress, a.addressLocality, a.postalCode].filter(Boolean).join(', ')
      if (!r.address && ld.name) r.address = ld.name
    }

    if (!r.price) {
      const priceData = ld.offers || ld.priceSpecification
      if (priceData) {
        const val = priceData.price || priceData.lowPrice
        if (val) Object.assign(r, parsePriceString(String(val)))
      }
      if (!r.price && ld.price) Object.assign(r, parsePriceString(String(ld.price)))
    }

    if (!r.bedrooms) r.bedrooms = toNum(ld.numberOfBedrooms ?? ld.numberOfRooms)
    if (!r.bathrooms) r.bathrooms = toNum(ld.numberOfBathroomsTotal ?? ld.numberOfBathrooms)

    if (!r.sqft && ld.floorSize) {
      const val = toNum(ld.floorSize.value ?? ld.floorSize)
      const unit = (ld.floorSize.unitCode || ld.floorSize.unitText || '').toLowerCase()
      r.sqft = (unit === 'smq' || unit.includes('m²') || unit.includes('sqm')) ? Math.round(val * 10.764) : val
    }

    if (!r.imageUrl && ld.image) {
      const img = Array.isArray(ld.image) ? ld.image[0] : ld.image
      r.imageUrl = typeof img === 'string' ? img : img?.url || img?.contentUrl || ''
    }

    // Agent from seller / provider
    if (!r.estateAgent) {
      const agentNode = ld.seller || ld.provider || ld.author
      if (agentNode) r.estateAgent = agentNode.name || ''
    }
    if (!r.agentContact) {
      const agentNode = ld.seller || ld.provider
      if (agentNode) r.agentContact = agentNode.telephone || ''
    }

    break
  }

  // ── Strategy 4: __NEXT_DATA__ (used by Foxtons, Chestertons, many agency sites) ──
  // Always run — JSON-LD (Strategy 3) may fill address/price but miss everything else
  const nd = tryExtractNextData(html)
  if (nd) {
    const propKeys = ['property', 'listing', 'propertyDetails', 'listingDetails', 'propertyDetail', 'result', 'data', 'details']
    let prop = null
    for (const k of propKeys) {
      const candidate = deepFind(nd, k)
      if (candidate && typeof candidate === 'object' && (candidate.address || candidate.price || candidate.bedrooms || candidate.description)) {
        prop = candidate
        break
      }
    }
    if (prop) {
      if (!r.address) {
        const addr = prop.address?.displayAddress || prop.address?.fullAddress || prop.address?.street
          || prop.address || prop.displayAddress || prop.fullAddress || prop.title || ''
        if (typeof addr === 'string') r.address = addr
      }
      if (!r.price) {
        const raw = prop.price || prop.displayPrice || prop.askingPrice || prop.guidePrice
          || prop.guidePriceTo || prop.salePrice || prop.rentPrice || prop.listPrice
        if (raw) Object.assign(r, parsePriceString(String(raw)))
      }
      if (!r.bedrooms) r.bedrooms = toNum(prop.bedrooms || prop.numBedrooms || prop.numberOfBedrooms || prop.beds || prop.bedroom_count)
      if (!r.bathrooms) r.bathrooms = toNum(prop.bathrooms || prop.numBathrooms || prop.numberOfBathrooms || prop.bathroom_count)
      if (!r.sqft) {
        const fa = prop.floorArea || prop.size || prop.sqft || prop.sqFeet
          || prop.area || prop.grossInternalArea || prop.internalArea || prop.floorAreaSqFt
        if (fa) {
          const val = toNum(typeof fa === 'object' ? (fa.value ?? fa.sqFeet ?? fa.sqMetres) : fa)
          const unit = (typeof fa === 'object' ? fa.unit || fa.unitText || '' : '').toLowerCase()
          r.sqft = (unit.includes('m') && !unit.includes('mile') && !unit.includes('sqf')) ? Math.round(val * 10.764) : val
        }
      }
      if (!r.estateAgent) {
        r.estateAgent = prop.agent?.name || prop.branch?.name || prop.agency?.name
          || prop.agent?.brandName || prop.agencyName || prop.branchName || ''
      }
      if (!r.agentContact) {
        r.agentContact = prop.agent?.phone || prop.branch?.phone || prop.agent?.telephone
          || prop.branch?.telephone || prop.agent?.contactNumber || prop.contactPhone || ''
      }
      if (!r.imageUrl) {
        const imgs = prop.images || prop.photos || prop.media || prop.mediaItems || []
        if (Array.isArray(imgs) && imgs.length > 0) {
          const img = imgs[0]
          r.imageUrl = typeof img === 'string' ? img : img?.url || img?.src || img?.mediaUrl || img?.originalUrl || ''
        }
      }
      if (!r.description) {
        r.description = prop.description || prop.fullDescription || prop.longDescription
          || prop.propertyDescription || prop.marketingDescription || prop.marketing_description || ''
      }
      if (!r.leaseLength) {
        const ll = prop.leaseLength || prop.leaseRemaining || prop.yearsRemaining || prop.leaseYears
        if (ll) r.leaseLength = `${ll} years remaining`
        else if (prop.leaseExpiry) {
          const rem = parseInt(prop.leaseExpiry) - new Date().getFullYear()
          if (rem > 0) r.leaseLength = `${rem} years remaining`
        }
      }
      if (!r.tenure) {
        r.tenure = prop.tenure || prop.tenureType || prop.ownershipType || ''
        if (r.tenure) r.tenure = r.tenure.charAt(0).toUpperCase() + r.tenure.slice(1).toLowerCase()
      }
      if (!r.serviceCharge) {
        const sc = prop.serviceCharge || prop.annualServiceCharge || prop.maintenanceCharge
          || prop.service_charge || prop.managementFee
        if (sc) r.serviceCharge = toNum(sc)
      }
      if (r.groundRent == null) {
        const gr = prop.groundRent || prop.ground_rent || prop.annualGroundRent
        if (gr != null) r.groundRent = toNum(gr)
        else if (/peppercorn/i.test(prop.tenure || '')) r.groundRent = 0
      }
    }
  }

  // ── Strategy 5: Google Analytics / GTM dataLayer ─────────────────────────
  if (!r.price || !r.bedrooms) {
    const dl = extractDataLayer(html)
    if (!r.price && dl.price) { r.price = dl.price; r.priceType = dl.priceType }
    if (!r.bedrooms) r.bedrooms = dl.bedrooms
    if (!r.bathrooms) r.bathrooms = dl.bathrooms
    if (!r.address && dl.address) r.address = dl.address
    if (!r.estateAgent && dl.estateAgent) r.estateAgent = dl.estateAgent
  }

  // ── Strategy 6: JSON key pattern scanning ────────────────────────────────
  if (!r.price) {
    const pricePatterns = [
      /"(?:askingPrice|asking_price|displayPrice|salePrice|purchasePrice|listPrice|rentPrice|monthlyRent)"\s*:\s*"?(\d[\d,]*)"?/i,
      /"price"\s*:\s*\{\s*"amount"\s*:\s*(\d+)/i,
      /data-price="(\d[\d,]*)"/i,
    ]
    for (const p of pricePatterns) {
      const m = html.match(p)
      if (m) {
        const val = parseInt(m[1].replace(/,/g, ''))
        if (val > 1000) { r.price = val; break }
      }
    }
  }
  if (!r.bedrooms) {
    const m = html.match(/"(?:bedrooms|numBedrooms|numberOfBedrooms|bedroomCount|beds)"\s*:\s*(\d+)/i)
      || html.match(/data-bedrooms="(\d+)"/i)
    if (m) r.bedrooms = parseInt(m[1])
  }
  if (!r.bathrooms) {
    const m = html.match(/"(?:bathrooms|numBathrooms|numberOfBathrooms|bathroomCount|baths)"\s*:\s*(\d+)/i)
      || html.match(/data-bathrooms="(\d+)"/i)
    if (m) r.bathrooms = parseInt(m[1])
  }

  // ── Strategy 7: Meta description for price / beds / baths ────────────────
  const metaDesc = getMeta(html, 'og:description') || getMeta(html, 'description') || ''
  if (!r.price && metaDesc) {
    const { price, priceType } = parsePriceString(metaDesc)
    if (price) { r.price = price; r.priceType = priceType }
  }
  if (!r.bedrooms && metaDesc) {
    const m = metaDesc.match(/(\d+)\s*bed/i)
    if (m) r.bedrooms = parseInt(m[1])
  }
  if (!r.bathrooms && metaDesc) {
    const m = metaDesc.match(/(\d+)\s*bath/i)
    if (m) r.bathrooms = parseInt(m[1])
  }

  // ── Strategy 8: Address from page title, strip agent name suffix ──────────
  if (!r.address) {
    let title = ogTitle || getTitle(html) || ''
    // "2 bed flat for sale | Foxtons Estate Agents" → "2 bed flat for sale"
    title = title.replace(/\s*[\|—–-]\s*.{0,40}(?:estate\s*agents?|lettings?|property|properties|realty)\b.*/i, '')
    // "Property details | Foxtons" → strip trailing " | Foxtons"
    title = title.replace(/\s*[\|—–-]\s*[A-Z][a-zA-Z &]+$/, '')
    r.address = title.trim()
  }

  // ── Fallbacks: sqft, charges, phone ──────────────────────────────────────
  if (!r.sqft) r.sqft = extractSqftFromHtml(html)
  if (!r.serviceCharge) r.serviceCharge = extractHtmlCharge(html, 'service.charge|management.charge')
  if (r.groundRent == null) {
    const gr = extractHtmlCharge(html, 'ground.rent')
    if (gr != null) r.groundRent = gr
    else if (/peppercorn|nil\s+ground|zero\s+ground/i.test(html)) r.groundRent = 0
  }
  if (!r.leaseLength) r.leaseLength = extractLeaseFromText(html)
  if (!r.estateAgent) r.estateAgent = extractAgentFromHtml(html)
  if (!r.agentContact) r.agentContact = extractPhoneFromHtml(html)

  // ── Description: og:description as last resort (most sites populate this) ──
  if (!r.description && metaDesc && metaDesc.length > 50) r.description = metaDesc

  return r
}

// ── Shared utilities ──────────────────────────────────────────────────────────

function tryExtractNextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]+?)<\/script>/)
  if (!m) return null
  try { return JSON.parse(m[1]) } catch { return null }
}

function extractBalancedJson(str, start) {
  let depth = 0, inStr = false, escape = false
  for (let i = start; i < str.length; i++) {
    const ch = str[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inStr) { escape = true; continue }
    if (ch === '"') { inStr = !inStr; continue }
    if (inStr) continue
    if (ch === '{' || ch === '[') depth++
    else if (ch === '}' || ch === ']') {
      depth--
      if (depth === 0) return str.slice(start, i + 1)
    }
  }
  return null
}

function deepFind(obj, key, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 6) return null
  if (obj[key] != null) return obj[key]
  for (const v of Object.values(obj)) {
    const found = Array.isArray(v)
      ? v.reduce((acc, item) => acc || deepFind(item, key, depth + 1), null)
      : deepFind(v, key, depth + 1)
    if (found != null) return found
  }
  return null
}

function parsePriceString(str) {
  if (!str) return { price: 0, priceType: null }
  const clean = str.replace(/[£$€,\s]/g, '')
  const num = parseInt(clean)
  const lower = str.toLowerCase()
  const isRent = /pcm|pw|per\s+month|per\s+week|\/mo|\/month/.test(lower)
  return { price: num || 0, priceType: isRent ? 'rent' : (num > 0 ? 'buy' : null) }
}

function getMeta(html, name) {
  const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"'<>]+)["']`, 'i')
  const re2 = new RegExp(`<meta[^>]+content=["']([^"'<>]+)["'][^>]+(?:property|name)=["']${name}["']`, 'i')
  return (html.match(re1) || html.match(re2) || [])[1] || ''
}

function getTitle(html) {
  return (html.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1]?.trim() || ''
}

function getJsonLdBlocks(html) {
  const blocks = []
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]+?)<\/script>/gi
  let m
  while ((m = re.exec(html)) !== null) {
    try {
      const p = JSON.parse(m[1].trim())
      Array.isArray(p) ? blocks.push(...p) : blocks.push(p)
    } catch {}
  }
  return blocks
}

// Try a list of regex patterns against text, return the first integer match or null
function extractChargeFromText(text, patterns) {
  for (const p of patterns) {
    const m = text.match(p)
    if (m) return parseInt(m[1].replace(/,/g, ''))
  }
  return null
}

// Extract lease length as a formatted string from any block of text
function extractLeaseFromText(text) {
  const patterns = [
    /(\d{2,4})\s+years?\s+(?:remaining|left|unexpired)/i,
    /approx(?:imately)?\s+(\d{2,4})\s+years?\s+remaining/i,
    /(?:lease\s+length|lease\s+remaining|remaining\s+lease)[^.]{0,30}(\d{2,4})\s+years?/i,
    /(\d{2,4})\s+year(?:s?)?\s+lease/i,
    /(?:leasehold|lease)[^.]{0,60}(\d{2,4})\s+year/i,
  ]
  for (const p of patterns) {
    const m = text.match(p)
    if (m) return `${m[1]} years remaining`
  }
  return null
}

// Scan HTML dt/dd pairs and JSON key-values for a financial charge
function extractHtmlCharge(html, labelPattern) {
  const re = new RegExp(
    `(?:<dt[^>]*>[^<]*(?:${labelPattern})[^<]*<\\/dt>\\s*<dd[^>]*>[^£<]*£\\s*([\\d,]+)|"(?:${labelPattern})"\\s*:\\s*"?£?\\s*([\\d,]+)"?)`,
    'i'
  )
  const m = html.match(re)
  if (m) return parseInt((m[1] || m[2]).replace(/,/g, ''))

  // Looser: just label followed by £amount within 60 chars
  const loose = new RegExp(`(?:${labelPattern})[^£\\d]{0,60}£\\s*([\\d,]+)`, 'i')
  const m2 = html.match(loose)
  if (m2) return parseInt(m2[1].replace(/,/g, ''))

  return null
}

// Extract agent name from HTML JSON blobs and meta tags
function extractAgentFromHtml(html) {
  const jsonKeys = [
    /"brandTradingName"\s*:\s*"([^"]+)"/i,
    /"agencyName"\s*:\s*"([^"]+)"/i,
    /"branchDisplayName"\s*:\s*"([^"]+)"/i,
    /"agentName"\s*:\s*"([^"]+)"/i,
    /"companyName"\s*:\s*"([^"]+)"/i,
  ]
  for (const p of jsonKeys) {
    const m = html.match(p)
    if (m && m[1].length < 80) return m[1]
  }
  return ''
}

// Extract a UK phone number from HTML
function extractPhoneFromHtml(html) {
  // Look for tel: links first (most reliable)
  const telLink = html.match(/href="tel:([^"]+)"/i)
  if (telLink) return telLink[1]
  // UK numbers must start with 0[1-9] (not 000...) — 11 digits total
  const phoneM = html.match(/\b(0[1-9]\d{9}|0[1-9]\d{2}\s\d{3}\s\d{4}|0[1-9]\d{3}\s\d{6}|\+44\s?[1-9]\d[\d\s]{8,11})\b/)
  if (phoneM) return phoneM[0].replace(/\s+/g, ' ').trim()
  return ''
}

// Extract sqft from a Rightmove propertyData object, trying every known path
function extractSqftFromPd(pd) {
  // Path 1: floorArea object { value, unit }
  if (pd.floorArea?.value) {
    const val = toNum(pd.floorArea.value)
    const unit = (pd.floorArea.unit || '').toLowerCase()
    return (unit.startsWith('sq') && unit.includes('m') && !unit.includes('mile'))
      ? Math.round(val * 10.764) : val
  }

  // Path 2: areaSizes array [{ sqFeet, sqMetres, unit }]
  const areaSizes = pd.areaSizes || pd.propertyData?.areaSizes || []
  if (areaSizes.length > 0) {
    const a = areaSizes[0]
    if (a.sqFeet) return toNum(a.sqFeet)
    if (a.sqMetres) return Math.round(toNum(a.sqMetres) * 10.764)
  }

  // Path 3: direct numeric fields
  const direct = pd.sqFeet ?? pd.sqft ?? pd.floorAreaSqFeet ?? pd.size
  if (direct) return toNum(direct)
  const directM = pd.sqMetres ?? pd.floorAreaSqm
  if (directM) return Math.round(toNum(directM) * 10.764)

  // Path 4: key features text — e.g. "650 sq ft (60 sq m)"
  const featsText = (pd.keyFeatures || pd.features || []).join(' ')
  const kfSqft = featsText.match(/(\d[\d,]*)\s*sq\.?\s*ft/i)
  if (kfSqft) return parseInt(kfSqft[1].replace(/,/g, ''))
  const kfSqm = featsText.match(/(\d[\d,.]*)\s*(?:sq\.?\s*m(?:etres?)?|sqm|m²)\b/i)
  if (kfSqm) return Math.round(parseFloat(kfSqm[1].replace(/,/g, '')) * 10.764)

  // Path 5: description text
  const desc = pd.text?.description || pd.summary || ''
  const dSqft = desc.match(/(\d[\d,]*)\s*sq\.?\s*ft/i)
  if (dSqft) return parseInt(dSqft[1].replace(/,/g, ''))
  const dSqm = desc.match(/(\d[\d,.]*)\s*(?:sq\.?\s*m(?:etres?)?|sqm|m²)\b/i)
  if (dSqm) return Math.round(parseFloat(dSqm[1].replace(/,/g, '')) * 10.764)

  return 0
}

// Scan raw HTML for sqft/sqm values — used as final fallback when PAGE_MODEL paths fail
function extractSqftFromHtml(html) {
  // JSON-embedded numeric keys (Rightmove embeds these in script tags)
  const jsonSqftPatterns = [
    /"sqFeet"\s*:\s*(\d+)/i,
    /"sqft"\s*:\s*(\d+)/i,
    /"floorAreaSqFeet"\s*:\s*(\d+)/i,
    /"areaSqFt"\s*:\s*(\d+)/i,
    /"sizeInFeet"\s*:\s*(\d+)/i,
  ]
  for (const p of jsonSqftPatterns) {
    const m = html.match(p)
    if (m) return parseInt(m[1])
  }
  const jsonSqmPatterns = [
    /"sqMetres"\s*:\s*([\d.]+)/i,
    /"sqm"\s*:\s*([\d.]+)/i,
    /"floorAreaSqm"\s*:\s*([\d.]+)/i,
    /"sizeInMetres"\s*:\s*([\d.]+)/i,
  ]
  for (const p of jsonSqmPatterns) {
    const m = html.match(p)
    if (m && parseFloat(m[1]) > 5) return Math.round(parseFloat(m[1]) * 10.764)
  }

  // Visible text patterns — "650 sq. ft." as displayed on the page
  const txtSqft = html.match(/(\d[\d,]{1,6})\s*sq\.?\s*ft\b/i)
  if (txtSqft) return parseInt(txtSqft[1].replace(/,/g, ''))
  const txtSqm = html.match(/(\d[\d,.]{1,6})\s*(?:sq\.?\s*m(?:etres?)?|sqm|m²)\b/i)
  if (txtSqm) {
    const v = parseFloat(txtSqm[1].replace(/,/g, ''))
    if (v > 5) return Math.round(v * 10.764)
  }
  return 0
}

function toNum(v) {
  if (v == null) return 0
  const n = Number(v)
  return isNaN(n) ? 0 : Math.round(n)
}

function capitalise(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : ''
}

// ── Vite config ───────────────────────────────────────────────────────────────

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'property-scraper',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith('/api/scrape')) return next()

          const qs = req.url.split('?')[1] || ''
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
