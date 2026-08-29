# Subscription & Free‑Trial — Mobile Integration Guide

For the mobile app team. The web frontend (`frontend/src/pages/Subscription.jsx`) already
consumes exactly this contract — mirror its behaviour.

Everything is **backend‑driven**. The mobile app renders whatever the API returns and must
**not** hardcode prices, trial duration, currency, or day counts, and must **not** convert
currencies with live exchange rates.

---

## 1. Auth & base URL

Same as every other consumer endpoint you already call (`/api/me`, `/api/transactions`, …):

```
Authorization: Bearer <supabase access_token>
```

No new auth, no new provider. Same Supabase project and JWT the app already uses.
All paths below are relative to your existing API base (`https://<backend-host>/api`).

---

## 2. Endpoints

### 2.1 `GET /api/subscription?locale=<BCP‑47 tag>`

The one call the subscription screen needs. Returns the user's live status **and** the
location‑aware pricing block.

| Query param | Value | Notes |
|---|---|---|
| `locale` | e.g. `en-IN`, `ar-AE`, `en-GB` | The device locale tag. `expo-localization` → `getLocales()[0].languageTag`, or the platform locale. Optional but recommended — it's the last fallback in currency detection. |

**200 response** (real example — INR configured, trial off, enforcement off):

```jsonc
{
  // ---- this user's subscription status ----
  "status": "FREE_ACCESS",          // FREE_ACCESS | FREE_TRIAL | ACTIVE | EXPIRED | CANCELLED
  "type": "FREE_ACCESS",            // stored intent: FREE_ACCESS | FREE_TRIAL | ACTIVE | CANCELLED
                                    // (EXPIRED is derived from dates, never a `type`)
  "trialStartDate": null,           // ISO 8601 or null
  "trialEndDate": null,             // ISO 8601 or null — the exact "free until" date
  "subscriptionStartDate": null,
  "subscriptionEndDate": null,
  "daysRemaining": 0,               // whole days until trialEndDate (or subscriptionEndDate
                                    // when ACTIVE), computed server-side, floored at 0

  // ---- global config ----
  "enforcementEnabled": false,      // false -> hide/disable the paid Monthly & Yearly section
  "trial": {
    "enabled": false,               // do NEW signups get a free trial?
    "durationMonths": 1             // trial length in calendar months (1..12)
  },

  // ---- location-aware pricing (admin-configured per currency; NEVER FX-converted) ----
  "pricing": {
    "currency": "INR",              // resolved currency for this user
    "source": "browser locale",     // how it was resolved (see §4)
    "defaultCurrency": "INR",
    "configured": true,             // false -> admin hasn't published prices yet; show "coming soon"
    "currencies": [                 // every enabled currency the user may switch to
      {
        "code": "INR", "symbol": "₹", "name": "Indian Rupee",
        "monthly": 60, "yearly": 600,
        "monthlyFormatted": "₹60", "yearlyFormatted": "₹600",
        "yearlySavingsPct": 17,
        "yearlyEquivalentMonthly": 50,
        "yearlyEquivalentMonthlyFormatted": "₹50"
      }
    ],
    "selected": { /* same shape as a currencies[] item — the one to display */ }
  }
}
```

**Always render money from the `*Formatted` strings** (`monthlyFormatted`, `yearlyFormatted`,
`yearlyEquivalentMonthlyFormatted`) — they are already locale‑formatted server‑side with
`Intl.NumberFormat`. The raw numeric `monthly` / `yearly` are there only if you need the value
for logic.

### 2.2 `PATCH /api/subscription/currency`

Called when the user picks a currency from the on‑screen selector.

```jsonc
// request
{ "currency": "USD" }              // must be one of pricing.currencies[].code

// 200 response
{ "pricing": { /* fresh pricing block, same shape as §2.1 pricing */ } }
```

Errors: `400 { "error": "invalid_currency" }` (bad format) or
`400 { "error": "currency_not_available" }` (not an enabled currency).

This persists `profiles.billing_currency` — a **billing‑display** currency that is **separate
from the app's money‑formatting currency** (`profiles.currency`, set in Settings → Location &
currency). It sticks across sessions and becomes the top‑priority signal next time (see §4).
**Do not** write `profiles.currency` from the subscription screen.

### 2.3 `GET /api/me` (already used by the app)

`response.user.subscription` now carries the **status block** from §2.1 (i.e. `status`, `type`,
`trialStartDate`, `trialEndDate`, `subscriptionStartDate`, `subscriptionEndDate`,
`daysRemaining`) — **without** `trial`, `enforcementEnabled`, or `pricing`.

Use this for a lightweight header/badge ("12 days left") anywhere in the app without a
dedicated request. For the full subscription screen, call `GET /api/subscription`.

---

## 3. Screen behaviour (mirror the web)

### Free card — always shown

| `status` | Show |
|---|---|
| `FREE_ACCESS` | "Free · ₹0", badge "Your current plan". If `trial.enabled` → highlighted note **“New accounts get a {trial.durationMonths}-month free trial.”** |
| `FREE_TRIAL` | Highlighted callout: big **`daysRemaining`** + "days left", **“Free until {format(trialEndDate)}”**, sub‑line "Trial started {format(trialStartDate)}". |
| `EXPIRED` | "Trial ended {format(trialEndDate)}", amber. |
| `ACTIVE` | Plain "Free · ₹0", no current badge. |
| `CANCELLED` | Plain "Free · ₹0". |

### Monthly & Yearly cards

Render the real, tappable plan cards **only when**
`enforcementEnabled === true` **AND** `pricing.configured === true` **AND** `pricing.selected` is present.

Otherwise show a single disabled placeholder ("Not active" / preview) using
`pricing.selected.monthlyFormatted` and `.yearlyFormatted` for a read‑only price preview, and
no subscribe buttons.

- Monthly card price → `selected.monthlyFormatted` + "per month".
- Yearly card → `selected.yearlyFormatted` + "per year", badge "Best value", note
  `Save {selected.yearlySavingsPct}% vs monthly · ≈ {selected.yearlyEquivalentMonthlyFormatted}/mo`
  (drop the "Save X%" half if `yearlySavingsPct` is 0).

### Currency selector

List `pricing.currencies` (each `{code, symbol, name}`; you can prefix a flag emoji derived
from the first two letters of `code`). On change → `PATCH /api/subscription/currency` → replace
local state with the returned `pricing`.

### Trial countdown

`daysRemaining` is already correct. If you want a live ticking countdown, recompute locally:
`Math.max(0, Math.ceil((Date.parse(trialEndDate) - Date.now()) / 86_400_000))`.
Never store or hardcode a day number.

### Subscribe buttons

There is **no payment gateway yet**. Wire the buttons to a "billing coming soon" state (or your
own placeholder). The data model already records `subscription_price_at_purchase` /
`subscription_currency` / `subscription_billing_period` so a provider can be added later without
changing this screen.

---

## 4. Currency detection (done server‑side — informational)

`GET /api/subscription` resolves the currency in this priority order, taking the first one that
has an **enabled price row**; otherwise `defaultCurrency`:

1. `preference` – the user's saved `billing_currency` (from a previous `PATCH …/currency`)
2. `account` – `profiles.currency` (Settings → Location & currency)
3. `billing country` – currency of `profiles.country`
4. `location` – country from the CDN geo header on the request (`cf-ipcountry`, etc.)
5. `browser locale` – region parsed from your `?locale=` query param
6. `default` – `pricing.defaultCurrency`

`pricing.source` tells you which one won. The mobile app's only job is to pass `?locale=` and,
if it has a more reliable device region, it may also send that as the locale tag. There is no
client‑side IP lookup and no exchange‑rate math anywhere.

---

## 5. Do / Don't

**Do**
- Read every value from the API response each time the screen opens.
- Use `*Formatted` strings for display.
- Gate the paid section on `enforcementEnabled && pricing.configured`.
- Use `trial.durationMonths` for the "N‑month free trial" copy and `trialEndDate` for the exact
  "valid until" date.

**Don't**
- Hardcode `₹50` / `₹500` / `60` / `600` / `INR` / `1 month` / `30 days` anywhere.
- Convert prices between currencies (no live FX — ever).
- Call any `/api/admin/*` endpoint. Pricing, trial length, enforcement and the default currency
  are configured only in the Super Admin panel (`/superadmin` → Subscriptions), guarded by
  `requireSuperAdmin`. The mobile app is read‑only for subscription config.
- Write `profiles.currency` from this screen (use `PATCH /api/subscription/currency`).

---

## 6. Backend source of truth (for reference)

| Concern | File |
|---|---|
| Consumer endpoints | `backend/src/routes/consumer.routes.js` (`GET /api/subscription`, `PATCH /api/subscription/currency`) |
| Status derivation, `daysRemaining`, calendar‑month math | `backend/src/services/subscriptionService.js` |
| Currency resolution + `Intl` formatting | `backend/src/services/currencyService.js` |
| Pricing block assembly | `backend/src/db.js` → `resolvePricingForUser` |
| Schema | `backend/supabase/migrations/0025_subscriptions.sql`, `0026_subscription_pricing.sql` |
| Admin config UI/API (not for mobile) | `backend/src/routes/admin/subscriptions.js`, `backend/admin/src/pages/Subscriptions/` |

Migrations `0025` and `0026` must be applied to the Supabase project (they already are on the
current environment). If `0026` is missing, `pricing.configured` comes back `false` and the app
should show the "plans coming soon" state.
