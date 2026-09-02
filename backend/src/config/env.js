// Central place every module reads process.env from, so nothing else has to
// parse or default these inline. dotenv is loaded by the entrypoint
// (backend/server.js) before this is required.

const PORT = process.env.PORT || 4000;

// Comma-separated list of allowed browser origins, e.g. "https://app.example.com,https://example.com".
// Empty/unset falls back to allowing any origin (fine for local dev, not for production).
const CORS_ORIGINS = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);

// Behind a reverse proxy / load balancer (typical in production), trust its
// X-Forwarded-For so req.ip and the rate limiter key on the real client IP
// instead of the proxy's. Only enable this if you actually sit behind one —
// trusting it blindly on a directly-exposed server lets clients spoof their IP.
const TRUST_PROXY = !!process.env.TRUST_PROXY;

// `skip` for the API rate limiter only fires when NODE_ENV is explicitly
// 'development' — an opt-in, not the default — so an unset/misconfigured
// NODE_ENV in production fails safe (limiter stays on).
const isDevEnv = process.env.NODE_ENV === 'development';

// Supabase project origin (no trailing slash), used in the Helmet CSP
// connect-src carve-out for the admin SPA's browser-side auth calls.
const SUPABASE_HOST = (process.env.SUPABASE_URL || '').replace(/\/$/, '');

// Anthropic API key for the server-side vision call behind POST
// /api/records/scan (bill / receipt / payment-screenshot scanner). Used
// only there; never sent to any client. Unset = the scan endpoint returns
// 502 and the mobile app falls back to manual entry.
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
// Only needed if ANTHROPIC_API_KEY is an identity-linked (workspace-scoped)
// key — those require the workspace id on every request. Leave unset for a
// normal API key.
const ANTHROPIC_WORKSPACE_ID = process.env.ANTHROPIC_WORKSPACE_ID || '';

// `version` is read from package.json (never hardcoded) — mobile's Settings
// > About screen surfaces it as "API Version" alongside its own app version.
const { version: API_VERSION } = require('../../package.json');

// ---------------------------------------------------------------------------
// Recurring billing (0029_subscription_billing.sql). Every one of these is
// OPTIONAL: with a provider's keys unset, that provider is simply "not
// configured" — checkout for it returns 503 and its webhook returns 503, and
// the rest of the app (including the admin-gated trial/enforcement flags)
// behaves exactly as it did before any billing existed. Never sent to a
// client bundle; read only by backend/src/services/billing/*.
// ---------------------------------------------------------------------------
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';

// country(2-letter) -> provider, plus a `*` wildcard. Default: India on
// Razorpay, everyone else on Stripe. Format: "IN:razorpay,*:stripe".
const SUBSCRIPTION_PROVIDER_MAP = process.env.SUBSCRIPTION_PROVIDER_MAP || 'IN:razorpay,*:stripe';

// Absolute origin the provider-hosted checkout redirects back to
// (…/app/subscription?status=success|cancelled). Falls back to the first
// CORS origin, then localhost for dev.
const APP_PUBLIC_URL = (process.env.APP_PUBLIC_URL || CORS_ORIGINS[0] || 'http://localhost:5173').replace(/\/$/, '');

module.exports = {
  PORT, CORS_ORIGINS, TRUST_PROXY, isDevEnv, SUPABASE_HOST, API_VERSION,
  ANTHROPIC_API_KEY, ANTHROPIC_WORKSPACE_ID,
  STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
  RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET,
  SUBSCRIPTION_PROVIDER_MAP, APP_PUBLIC_URL,
};
