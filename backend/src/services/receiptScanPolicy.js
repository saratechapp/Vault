// Backend-controlled limits for the AI bill / receipt / payment-screenshot
// scanner (POST /api/records/scan). Same "config owns the numbers, nothing
// else hardcodes them" philosophy as plans.js / subscriptionService.js.
//
// The mobile app NEVER hardcodes any of these — it reads the resolved quota
// (scope / limit / used / remaining / subscriptionStatus) from
// GET /api/records/scan/quota and from each scan response, and renders the
// upgrade screen purely from that. Tune the numbers here and both the gate
// and every "N scans left" / "you've used all N" string follow with no app
// release.
//
// Manual entry and plain manual file/image upload are unaffected by any of
// this — only the AI extraction call is metered.

// Master switch. Off ⇒ the scanner is unmetered for everyone (the pre-limit
// behaviour). Kept as a one-liner so the cap can be lifted without a code
// change if that ever becomes the product call.
const ENFORCED = true;

// Free = no active paid subscription (FREE_ACCESS, EXPIRED, CANCELLED, or a
// lapsed trial). A LIFETIME cap: 3 AI scans, ever — per user, on the
// backend, un-bypassable by reinstall / clearing storage / logout-login /
// another device (the counter is keyed on the Supabase auth user id).
const FREE = { scope: 'lifetime', limit: 3 };

// Active paid subscriber. There is no stored billing-interval column yet, so
// "Monthly plan" and "Yearly plan" are two prices for the same ACTIVE tier —
// both currently resolve to MONTHLY here. `YEARLY` is kept ready so that
// once a `billing_interval` lands on the profile, switching an annual
// subscriber to the yearly window is a one-line change in receiptScanQuota
// (policyFor) with no other edits.
const MONTHLY = { scope: 'month', limit: 300 };
const YEARLY = { scope: 'year', limit: 3000 };

// Free trial — the paid experience preview. Gets a real (if smaller) monthly
// allowance rather than the 3-scan lifetime cap.
const TRIAL = { scope: 'month', limit: 50 };

module.exports = { ENFORCED, FREE, MONTHLY, YEARLY, TRIAL };
