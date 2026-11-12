# Onboarding, funnel tracking and paywall

## How it works

- **Email first.** Starting or joining a board asks for an email (first name optional, marketing opt-in unticked). Opening a shared board link asks too.
- **Plans belong to boards.** One payment covers everyone on that board.

| Plan | Price | Homes | Boards | Scorecards |
|---|---|---|---|---|
| Free | £0 | 3 to start, 5 with your email | – | unlimited |
| Search pass | £9.99 once | unlimited, forever | the board it was bought on | unlimited |

Everyone starts on Free. The old Unlimited plan (£15, all boards) is no longer offered but is still honoured for anyone who bought it.

- **The paywall appears** when someone adds a home past the free limit, or taps **Upgrade** in the board menu. There is no scorecard paywall any more: the free limit is on homes only.
- **Not built yet:** the 3-then-5 step. Email is captured at sign-up today, so the effective free limit is 5. The permanent tally (deleted homes still count) and the later email step are still to do; for now the limit counts the homes currently on the board.
- Limits live in `billing.js` (`PLANS`, `FREE_SCORE_AFTER`) and the paywall copy lives in `src/App.jsx` (`Paywall`).

## Payments

- **Demo mode (default):** choosing a plan unlocks the board straight away. The paywall shows "Demo mode: no card needed".
- **Real payments:** create one one-off Price in Stripe (£9.99), then set these environment variables on the server, never in code:

| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key (use a test key first) |
| `STRIPE_PRICE_TEN` | Price ID for the Search pass (£9.99). The name `TEN` is historical |
| `APP_URL` | Public app URL, used for Checkout return links |

With all three Stripe variables set, the paywall redirects to Stripe Checkout. When the buyer returns, `/api/checkout/verify` confirms the payment with Stripe before unlocking the board. Before launch, add a Stripe webhook as a backstop for buyers who close the tab before they're redirected back.

## Funnel tracking

- **Where events go:** they're stored first-party in the `events` table (Postgres), or in `.data/dev-store.json` locally.
- **How visits are linked:** the landing page and the app share one anonymous visitor ID. The landing page passes it to the app with `?aid=` alongside `ref`, `cta` and any `utm_*` tags. The first-touch attribution is saved with the user's email.

`landing_view → landing_cta → app_open → onboarding_view → email_submitted → board_created / board_joined → listing_added → scorecard_started → paywall_shown → plan_selected → checkout_started → purchase_completed`

**Reading the numbers:** set `ADMIN_TOKEN` on the server, then:

```sh
curl -H "Authorization: Bearer $ADMIN_TOKEN" https://<app>/api/admin/funnel   # unique visitors per step
curl -H "Authorization: Bearer $ADMIN_TOKEN" https://<app>/api/admin/users    # emails, plans, attribution
```

**Landing page:** set `APP_URL` at the top of the script in `landing/index.html` to the live app URL before publishing.

## Before launch

- [ ] Publish a privacy notice covering email use and analytics (UK GDPR), and link it from the email step.
- [ ] Only send marketing to users with `marketing = true`.
- [ ] Decide what "Unlimited, forever" covers as features grow. The copy is currently neutral: "Unlimited homes, forever."
