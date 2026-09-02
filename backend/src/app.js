// Express app factory. server.js (the entrypoint) calls createApp() and
// binds a port; tests call it and drive it in-process. No side effects on
// require beyond building the router graph.
//
// The middleware chain order here is load-bearing and must not be reordered:
//   trust proxy -> helmet -> compression -> cors -> morgan -> json body
//   -> /api rate limiter -> /api/admin -> /superadmin static -> /api consumer
//   routes -> 404 -> error handler
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
const fs = require('fs');

const { CORS_ORIGINS, TRUST_PROXY, SUPABASE_HOST } = require('./config/env');
const { apiLimiter } = require('./middleware/rateLimiters');
const { notFound, jsonErrorHandler } = require('./middleware/errorHandlers');
const adminRoutes = require('./routes/admin');
const billingWebhookRoutes = require('./routes/billingWebhooks');
const consumerRoutes = require('./routes');

function createApp() {
  const app = express();

  // Fail safe, not open: an unset CORS_ORIGIN in production means
  // `cors()` below would reflect ANY origin. That's a misconfiguration, not
  // a valid deployment — refuse to boot rather than silently run wide open.
  // Local dev / tests (NODE_ENV !== 'production') keep the permissive default.
  if (process.env.NODE_ENV === 'production' && CORS_ORIGINS.length === 0) {
    throw new Error('CORS_ORIGIN must be set in production (comma-separated allowed origins). Refusing to start with an open CORS policy.');
  }

  if (TRUST_PROXY) app.set('trust proxy', 1);

  // Default Helmet, with carve-outs for the Admin panel (the Vite/MUI SPA
  // served as static files under /superadmin, see below):
  //   - connect-src: the SPA authenticates directly against Supabase Auth
  //     from the browser, so the Supabase origin must be allowed — Helmet's
  //     default of 'self' would block those XHRs.
  //   - style-src / style-src-elem: MUI + Emotion inject runtime <style> tags,
  //     which Helmet's default 'self' rejects. 'unsafe-inline' for styles only
  //     (not scripts) is the standard trade-off for Emotion-based UIs.
  // script-src stays at Helmet's default 'self' — the Vite production bundle
  // is same-origin module scripts with no inline code.
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'connect-src': ["'self'", ...(SUPABASE_HOST ? [SUPABASE_HOST] : [])],
        'img-src': ["'self'", 'data:'],
        'style-src': ["'self'", "'unsafe-inline'"],
        'style-src-elem': ["'self'", "'unsafe-inline'"],
      },
    },
  }));
  app.use(compression());
  app.use(cors(CORS_ORIGINS.length ? { origin: CORS_ORIGINS } : {}));
  app.use(morgan('dev'));

  // Recurring-billing webhooks (Stripe / Razorpay). Mounted BEFORE the JSON
  // body parser and BEFORE the /api rate limiter on purpose: each handler must
  // verify its signature against the exact received bytes, and a burst of
  // provider retries must never be throttled by the blanket /api limiter. This
  // router brings its own raw-body parser and a generous dedicated limiter.
  app.use('/api/billing/webhook', billingWebhookRoutes);

  app.use(express.json({ limit: '5mb' }));

  app.use('/api', apiLimiter);

  // Super Admin Panel — a fully separate auth boundary (requireAdminAuth,
  // applied once inside this router) from the consumer requireAuth.
  app.use('/api/admin', adminRoutes);

  // Super Admin Panel UI — the Vite React SPA in backend/admin, served as
  // static files under /superadmin (same origin as /api/admin above). This
  // matches admin/vite.config.js `base: '/superadmin/'` and main.jsx
  // `<BrowserRouter basename="/superadmin">`. Built by `npm run build` (see
  // package.json), which produces backend/admin/dist. The existsSync guard
  // keeps the API booting normally when the admin build hasn't run yet
  // (local API-only dev, unit tests that require() this file).
  const ADMIN_DIST = path.join(__dirname, '..', 'admin', 'dist');
  if (fs.existsSync(ADMIN_DIST)) {
    app.use('/superadmin', express.static(ADMIN_DIST, { index: false }));
    // SPA entry + fallback: the bare path and any client-routed path under it
    // (deep link / refresh) return index.html; real asset requests are already
    // handled by express.static above. index.html references its assets by
    // absolute /superadmin/... URLs, so a trailing slash isn't required.
    app.get(['/superadmin', '/superadmin/*'], (req, res) => res.sendFile(path.join(ADMIN_DIST, 'index.html')));
  }

  // Consumer API — every route file still declares its full `/api/...` path
  // and applies requireAuth per-route, so req.path / req.originalUrl are
  // identical to when these lived inline in server.js (requireAuth's 2FA
  // exempt-prefix check depends on that).
  app.use(consumerRoutes);

  // 404 + error handling (must be last)
  app.use(notFound);
  app.use(jsonErrorHandler);

  return app;
}

module.exports = { createApp };
