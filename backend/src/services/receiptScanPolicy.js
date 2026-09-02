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

// Active paid subscriber. 15 scan SESSIONS per BILLING PERIOD (a session may
// bundle up to 4 images and still counts as one). The window is the user's
// actual subscription period — it resets on the renewal anniversary
// (current_period_start advancing), NOT on the 1st of the calendar month.
// The monthly and yearly plans get the same 15; the yearly plan's period is
// simply a year. See receiptScanQuota.windowKeyFor for the 'billing_period'
// window derivation. `MONTHLY`/`YEARLY` names kept so policyFor's mapping is a
// one-liner.
const MONTHLY = { scope: 'billing_period', limit: 15 };
const YEARLY = { scope: 'billing_period', limit: 15 };

// Free trial — the paid experience preview, so the SAME 15 per billing period.
// A trial started via the provider has a real period; the pre-checkout
// auto-trial (0025, no provider subscription yet) falls back to a calendar
// month window (windowKeyFor), which is the closest thing to a "period" it has.
const TRIAL = { scope: 'billing_period', limit: 15 };

module.exports = { ENFORCED, FREE, MONTHLY, YEARLY, TRIAL };
