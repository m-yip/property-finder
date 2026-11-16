# Homeswoon (beta)

**House hunting, kept calm.** One shared board for every listing, estate agent, viewing and gut feeling. Score each home while it's fresh, and decide together.

## What it does

- **Add a home:** paste a Rightmove, Zoopla, OnTheMarket or agent link, and the price, size, photos and agent fill in for you.
- **Track the search:** homes move from *Saved* to *Enquired* to *Visiting* to *Seen*. The agent and their number are on every card, and viewing dates sit in the Visiting column.
- **Score every viewing:** 20 quick questions across six categories, about two minutes on your phone, plus deal-makers for things like a balcony or good light.
- **See your favourites:** a ranked leaderboard showing each home's strongest and weakest categories.
- **Share the board:** a six-letter board code, so your partner, family or housemates see the same homes, scores and notes.
- **Spot dead listings:** homes the agent has taken down are flagged "No longer listed", and your notes and scores are kept.

## Plans

- **Beta:** everything is free and unlimited while `BETA_FREE` isn't `0`. The plans below apply once it's switched off.
- **Free:** 3 homes to start, 5 with your email.
- **Search pass (£9.99, one-off):** unlimited homes on one board, forever. No subscription.
- **Shared boards:** one payment covers everyone on the board.
- **Payments:** demo mode by default, switching to Stripe Checkout when the Stripe environment variables are set. Setup is in [docs/payments.md](docs/payments.md).

## Tech

- **App:** React 18 + Vite (`src/App.jsx`), in the Limewash design system (Cormorant Garamond, Manrope, terracotta accent).
- **Server:** Node (`server.js`) serves the built app and the API:
  - boards and sync: Postgres
  - listing extraction: `scraper.js`, with headless Chromium as a fallback
  - availability checks
  - onboarding, funnel tracking and plans: `billing.js`
- **Website** (`landing/`): static HTML, no build step.
  - `index.html`: the landing page
  - `teaser.html`: the fallback teaser
  - `privacy.html`: the privacy notice

## Run locally

```sh
npm install
npm run dev          # http://localhost:5173 (local JSON store, no database needed)
npm run build && npm start   # production server on :3000
```

**Environment variables** (all optional locally):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection |
| `ADMIN_TOKEN` | Unlocks the admin funnel and user endpoints |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_TEN` (the £9.99 pass) | Real Stripe Checkout |
| `APP_URL` | Public app URL, for Checkout return links |
| `BETA_FREE` | Free, unlimited beta. On unless set to `0` |
| `SIGNUPS_SHEET_URL` | Google Apps Script URL. App users who tick "send me updates" are added to the sign-ups sheet |
| `VITE_LANDING_URL` | Website URL (e.g. `https://homeswoon.pages.dev`), used for the app's privacy link |

## Hosting

One repo, two hosts. Both redeploy on every push to `master`.

| | Host | Settings |
|---|---|---|
| **Website** (`landing/`) | Cloudflare Pages | Root directory `landing`, no build command, output directory `/` |
| **App** (repo root) | Railway, plus its Postgres | `nixpacks.toml` installs Chromium and runs `node server.js`. Set the builder to Nixpacks if Railway picks Railpack. |

**Website settings:** at the top of the script in `landing/index.html` and near the bottom of `landing/teaser.html`, set:
- `APP_URL`: the Railway app URL
- `SHEET_URL`: the Google Apps Script URL

**Swap the homepage to the teaser:** uncomment the line in `landing/_redirects` and push.

## Sign-ups (CSV)

Everyone who asks for updates lands in one Google Sheet. Set it up with [docs/signups-sheet.gs](docs/signups-sheet.gs). It collects:
- the landing page form (`source: landing`)
- the teaser (`teaser`)
- app users who tick "send me updates" (`app`)

To download it, open the Sheet, then **File → Download → CSV**.

**Backup of every app user:** `curl -H "Authorization: Bearer $ADMIN_TOKEN" https://<app>/api/admin/users.csv -o users.csv`

## Docs

- [Payments, tracking and paywall](docs/payments.md)
- [Content guidelines](docs/content-guidelines.md)

Demo homes are fictional. Photos are from Unsplash and Pexels ([credits](landing/assets/demo-images/CREDITS.md)).
