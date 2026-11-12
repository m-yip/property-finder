# Nest Well

**House hunting, kept calm.** One shared board for every listing, estate agent, viewing and gut feeling. Score each home while it's fresh, and decide together.

## What it does

- **Add a home:** paste a Rightmove, Zoopla, OnTheMarket or agent link, and the price, size, photos and agent fill in for you.
- **Track the search:** homes move from *Saved* to *Enquired* to *Visiting* to *Seen*. The agent and their number are on every card, and viewing dates sit in the Visiting column.
- **Score every viewing:** 20 quick questions across six categories, about two minutes on your phone, plus deal-makers for things like a balcony or good light.
- **See your favourites:** a ranked leaderboard showing each home's strongest and weakest categories.
- **Share the board:** a six-letter board code, so your partner, family or housemates see the same homes, scores and notes.
- **Spot dead listings:** homes the agent has taken down are flagged "No longer listed", and your notes and scores are kept.

**Landing page:** a static page in `landing/index.html`, with only the images and videos it uses in `landing/assets/`.

## Plans

- **Free:** 3 homes to start, 5 with your email. Everyone starts here.
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
- **Landing page:** a single static HTML file, no build step.

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

## Docs

- [Payments, tracking and paywall](docs/payments.md)
- [Content guidelines](docs/content-guidelines.md)

Demo homes are fictional. Photos are from Unsplash and Pexels ([credits](landing/assets/demo-images/CREDITS.md)).
