/**
 * Homeswoon sign-ups → Google Sheet
 *
 * Collects everyone who asks for updates, from three places:
 *   landing  – the "Get the latest updates" form on the landing page
 *   teaser   – the fallback teaser page
 *   app      – people who tick "Send me updates" when they sign up in the app
 *                 (the server forwards these when SIGNUPS_SHEET_URL is set on Railway)
 * Download it any time: File → Download → Comma-separated values (.csv).
 *
 * Setup (about 5 minutes):
 * 1. Create a Google Sheet, e.g. "Homeswoon sign-ups".
 * 2. Extensions → Apps Script. Delete what's there, paste this whole file, Save.
 * 3. Deploy → New deployment → type "Web app".
 *      Execute as: Me      Who has access: Anyone
 *    Approve the permissions prompt (it only needs this one spreadsheet).
 * 4. Copy the Web app URL (ends in /exec). It goes in:
 *      SHEET_URL in landing/index.html and landing/teaser.html
 *      SIGNUPS_SHEET_URL on Railway
 *
 * Changed this script later? Deploy → Manage deployments → edit → Version: New version,
 * so the same URL keeps working.
 */

const SHEET_NAME = 'Sign-ups'
const HEADERS = ['Joined', 'Email', 'Source', 'Searching', 'Name', 'utm_source', 'utm_medium', 'utm_campaign', 'ref', 'Referrer', 'Page']

function doPost(e) {
  const lock = LockService.getScriptLock()
  lock.waitLock(10000)
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}')
    if (d.website) return reply('ok') // honeypot: only bots fill this in
    const email = String(d.email || '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) return reply('invalid')

    const ss = SpreadsheetApp.getActiveSpreadsheet()
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME)
    if (sheet.getLastRow() === 0) { sheet.appendRow(HEADERS); sheet.setFrozenRows(1) }

    // Skip duplicates: someone signing up twice (or on two forms) stays one row
    const last = sheet.getLastRow()
    if (last > 1) {
      const emails = sheet.getRange(2, 2, last - 1, 1).getValues().flat()
      if (emails.indexOf(email) !== -1) return reply('exists')
    }

    sheet.appendRow([new Date(), email, d.source || 'unknown', d.searching, d.name,
      d.utm_source, d.utm_medium, d.utm_campaign, d.ref, d.referrer, d.page].map(safe))
    return reply('ok')
  } catch (err) {
    return reply('error')
  } finally {
    lock.releaseLock()
  }
}

// Stops values like "=HYPERLINK(...)" being run as formulas, and caps length
function safe(v) {
  if (v instanceof Date) return v
  const s = String(v == null ? '' : v).slice(0, 300)
  return /^[=+\-@]/.test(s) ? "'" + s : s
}

function reply(status) {
  return ContentService.createTextOutput(JSON.stringify({ status: status })).setMimeType(ContentService.MimeType.JSON)
}
