# Recurring Billing — Test‑Mode Runbook

Everything needed to exercise the full subscription lifecycle in **Stripe test
mode** and **Razorpay test mode**. Nothing here runs in CI — the automated
coverage (signature verification, event normalization, the webhook state
machine, the 15‑per‑billing‑period scan reset) lives in
`backend/src/services/billing/__tests__/` and
`backend/src/services/__tests__/subscriptionBillingService.test.js` and runs
with `npm test`. This document is the human, end‑to‑end pass.

---

## 0. Architecture in one paragraph

The **provider** (Razorpay for India / INR, Stripe elsewhere — routed by
`SUBSCRIPTION_PROVIDER_MAP`, INR always forces Razorpay) collects every
recurring payment. The mobile app opens the provider's native mandate/payment
sheet with data from `POST /api/billing/subscribe`; it never charges anything
itself. The backend reacts **only** to signature‑verified webhooks
(`POST /api/billing/webhook/{stripe,razorpay}`), writes the `subscriptions`
table, and mirrors that state onto `profiles.subscription_*` — which is what
`subscriptionService.computeStatus` (the single source of premium truth) and
the AI‑scan quota already read. A client request can never set
`status` / `plan` / `amount` / `scansRemaining`.

---

## 1. One‑time setup

### 1.1 Apply the migration

Run `backend/supabase/migrations/0029_subscription_billing.sql` in the Supabase
SQL editor (same as 0025–0028). It adds `subscriptions`,
`subscription_events`, the `profiles.subscription_*` mirror columns, and the
provider‑plan‑id columns on `subscription_prices`. Until it's applied,
`POST /api/billing/subscribe` returns a clean `409 pricing_not_configured` /
`503` and webhooks return `503` — nothing else changes.

### 1.2 Provider accounts + keys → `backend/.env`

```
STRIPE_SECRET_KEY=sk_test_…
STRIPE_PUBLISHABLE_KEY=pk_test_…
STRIPE_WEBHOOK_SECRET=whsec_…            # from `stripe listen` or the dashboard
RAZORPAY_KEY_ID=rzp_test_…
RAZORPAY_KEY_SECRET=…
RAZORPAY_WEBHOOK_SECRET=…                # you choose this when creating the webhook
SUBSCRIPTION_PROVIDER_MAP=IN:razorpay,*:stripe
APP_PUBLIC_URL=https://<your-tunnel-or-host>
```

Restart the backend (`npm run dev` — no hot reload for env).

### 1.3 Prices + provider plans

1. In the **admin panel** → Subscriptions → Pricing, add at least:
   - `INR` (routes to Razorpay) — e.g. ₹99 / ₹899
   - one non‑INR currency, e.g. `USD` (routes to Stripe) — e.g. $1.99 / $17.99
   Set `enforcementEnabled = true` in Subscriptions → Settings (real checkout
   is gated on it, same as the paywall screen).
2. Create the provider Products/Prices/Plans and write their ids back:
   ```
   cd backend
   DRY_RUN=1 node scripts/seed-provider-plans.js      # preview
   node scripts/seed-provider-plans.js                # create + persist ids
   ```
   Re‑runnable and idempotent. Or paste ids by hand into the admin Pricing
   row fields (`stripePriceMonthly` etc.) if you already made them.

### 1.4 Webhook endpoints

**Stripe** (local):
```
stripe listen --forward-to localhost:4000/api/billing/webhook/stripe \
  --events customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,customer.subscription.paused,customer.subscription.resumed,customer.subscription.trial_will_end,invoice.paid,invoice.payment_failed
```
Copy the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET`.

**Razorpay**: expose the backend (`ngrok http 4000`) and in the Razorpay
dashboard → Settings → Webhooks add
`https://<ngrok>/api/billing/webhook/razorpay` with the secret you put in
`RAZORPAY_WEBHOOK_SECRET`, subscribing to: `subscription.authenticated`,
`subscription.activated`, `subscription.charged`, `subscription.pending`,
`subscription.halted`, `subscription.cancelled`, `subscription.completed`,
`subscription.paused`, `subscription.resumed`.

### 1.5 Mobile build

Native SDKs (`@stripe/stripe-react-native`, `react-native-razorpay`) require a
dev build — **not Expo Go**:
```
cd "Mobile App/Wallet"
npm install
npm run prebuild:clean
npm run run:ios      # or run:android
```
Point `EXPO_PUBLIC_API_URL` at the same host the webhooks hit.

---

## 2. Signature‑verification smoke (do this first)

| Check | How | Expect |
|---|---|---|
| Stripe rejects a bad signature | `curl -XPOST localhost:4000/api/billing/webhook/stripe -d '{}' -H 'stripe-signature: t=1,v1=bad'` | `400 {"error":"invalid_signature"}`, nothing written |
| Razorpay rejects a bad signature | same against `/razorpay` with `x-razorpay-signature: bad` | `400 invalid_signature` |
| Provider not configured | unset a `*_WEBHOOK_SECRET`, hit its endpoint | `503`, no crash |
| Client can't fake premium | `PATCH /api/me` / `POST /api/transactions` with `status:"active"`, `plan:"premium"`, `scansRemaining:15` in the body | ignored — `GET /api/me` `user.subscription.status` unchanged |
| Replay is a no‑op | `stripe events resend <id>` (or re‑POST a captured Razorpay body with the same `x-razorpay-event-id`) | second delivery: `200`, `subscription_events.processed_at` already set, no state change |

---

## 3. Lifecycle checklist

Run once with a **USD** account (Stripe) and once with an **INR** account
(Razorpay). Test cards:

- Stripe: `4242 4242 4242 4242` (ok), `4000 0025 0000 3155` (3DS/SCA),
  `4000 0000 0000 9995` (decline on renewal).
- Razorpay test mode: use the test card / test UPI `success@razorpay` (auth
  succeeds) and `failure` handles for the failed‑renewal step.

| # | Step | Action | Expected (`GET /api/subscription` + DB + provider dashboard) |
|---|---|---|---|
| 1 | **New subscription (monthly)** | App → Subscription → Monthly → complete sheet | `status: ACTIVE`, `provider` set, `billingCycle: monthly`, `subscriptions` row `active`, `current_period_end` ≈ +1 month, `next_billing_date` = that. `subscription_events` has the activation + `invoice.paid` / `subscription.charged`. |
| 2 | **Free trial** | Fresh account that is mid `FREE_TRIAL` (auto‑granted at signup) → subscribe | Provider gets `trial_end` / `start_at` = the remaining trial. Row `trialing` (Stripe) / `authenticated` (Razorpay). `status: FREE_TRIAL`, **no charge yet**, `daysRemaining` = trial days left. |
| 3 | **Trial → paid conversion** | Fast‑forward: Stripe `stripe subscriptions update <id> --trial-end=now`; Razorpay — set `start_at` near‑now at create, wait | `invoice.paid` / `subscription.charged` fires → row `active`, `status: ACTIVE`, period starts now. No double charge. |
| 4 | **Successful renewal** | Stripe: `stripe trigger invoice.paid` for the sub, or advance the test clock; Razorpay: wait for the next `charge_at` / trigger from dashboard | `current_period_start/end` advance, `next_billing_date` moves forward, `status` stays `ACTIVE`. **AI‑scan count resets** (see §4). |
| 5 | **Failed renewal** | Swap default card to `4000 0000 0000 9995` then trigger the renewal (Stripe: `stripe trigger invoice.payment_failed`); Razorpay: `subscription.pending` / `halted` | Row → `past_due`. `status` **stays** premium (`ACTIVE`) until `current_period_end` — access is NOT dropped. App shows a "payment problem" state from `status` = the row's `past_due` surfacing (`GET /api/subscription`). |
| 6 | **Cancel** | App → Manage → Cancel subscription | `POST /api/billing/cancel` → provider `cancel_at_period_end` (Stripe) / `cancel(subId, true)` (Razorpay). Row `cancel_at_period_end = true`, `status` still `ACTIVE`, `nextBillingDate: null`. Confirmation copy: "Premium stays until {subscriptionEndDate}". |
| 7 | **Expiration** | Advance past `current_period_end` (Stripe test clock; Razorpay dashboard) → `customer.subscription.deleted` / `subscription.cancelled` | Row `expired`/`cancelled`, mirror `EXPIRED`. `status: EXPIRED`. AI scans drop to the free lifetime cap (3, minus prior lifetime use). |
| 8 | **Resume before expiry** | During #6's window, App → Manage → Resume | Stripe: `POST /api/billing/resume` → `cancel_at_period_end = false`, `nextBillingDate` back. Razorpay: `409 resume_not_supported` — the app hides the Resume button for Razorpay. |
| 9 | **Resubscribe** | After #7, subscribe again | New `subscriptions` row (old one stays `expired` for history), fresh `active`. |
| 10 | **Yearly plan** | Repeat #1 choosing Yearly | `billingCycle: yearly`, `current_period_end` ≈ +1 year. Renewal (#4) after a year. |
| 11 | **Pause (Stripe only, optional)** | `stripe subscriptions update <id> --pause-collection.behavior=void` | Row `paused`, mirror `CANCELLED`, no premium. `--pause-collection=""` → `resumed` → `ACTIVE`. |

---

## 4. AI‑scan allowance = 15 per **billing period**

- Paid **and** trial: 15 scan sessions per `current_period_start → end` window
  (a session bundles up to 4 images and still counts as **one**). Free tier
  unchanged: 3 per lifetime.
- The window key is `bp:<current_period_start ms>` (see
  `receiptScanQuota.windowKeyFor`). A renewal webhook advances
  `current_period_start` → the key changes → `receipt_scan_totals.window_count`
  restarts. **No cron, no calendar‑month logic.**

Test: as an ACTIVE user, run 15 scans → 16th returns `403 upgrade_required`
with `quota.remaining = 0`. Trigger a renewal (#4). `GET /api/records/scan/quota`
→ `remaining: 15` again, `periodStart` / `periodEnd` = the new window.

Pre‑checkout auto‑trial users (no provider subscription yet) fall back to a
calendar‑month window — the closest thing to a "period" they have.

---

## 5. What to verify in Supabase after each step

```sql
select provider, status, provider_status, billing_cycle, amount, currency,
       current_period_start, current_period_end, next_billing_date, cancel_at_period_end
from subscriptions where user_id = '<uid>' order by created_at desc;

select id, provider, type, canonical_type, processed_at, error
from subscription_events order by received_at desc limit 20;

select subscription_type, subscription_provider, subscription_current_period_end,
       subscription_cancel_at_period_end, trial_ends_at, subscription_ends_at
from profiles where id = '<uid>';
```

The `subscriptions` row must match the provider dashboard; `profiles` must
match `subscriptions` (the mirror); `subscription_events.processed_at` must be
non‑null for every accepted event and `error` null.

---

## 6. Follow‑ups deferred from this pass

- Admin panel Pricing UI text inputs for the four provider‑plan‑id fields
  (`SubscriptionsPage.jsx`). The API (`PUT /api/admin/subscriptions/prices/:currency`)
  already accepts and returns them; `scripts/seed-provider-plans.js` is the
  interim path.
- Mid‑cycle plan change (monthly ↔ yearly) + proration — v1 is cancel + resubscribe.
- Dunning emails / push on `past_due` — currently surfaced only via
  `GET /api/subscription` status for the app to render a banner.
- **App Store / Play policy**: selling digital subscriptions via Stripe/Razorpay
  instead of IAP needs product/legal sign‑off before store submission.
