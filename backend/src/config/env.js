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

// `version` is read from package.json (never hardcoded) — mobile's Settings
// > About screen surfaces it as "API Version" alongside its own app version.
const { version: API_VERSION } = require('../../package.json');

module.exports = { PORT, CORS_ORIGINS, TRUST_PROXY, isDevEnv, SUPABASE_HOST, API_VERSION };
