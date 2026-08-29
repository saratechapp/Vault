const rateLimit = require('express-rate-limit');
const { isDevEnv } = require('../config/env');

// Blanket API abuse guard. Auth itself is handled by Supabase (not a route
// on this server), so there's no separate auth-specific limiter here.
//
// `skip` only fires when NODE_ENV is explicitly 'development' — an opt-in,
// not the default — so an unset/misconfigured NODE_ENV in production fails
// safe (limiter stays on) rather than silently disabling itself. Local dev
// now runs two frontend apps plus hot-reload against one backend, which
// burns through 300 req/15min fast; production behavior is unchanged.
const API_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const API_RATE_LIMIT_MAX = 300;
const apiLimiter = rateLimit({
  windowMs: API_RATE_LIMIT_WINDOW_MS,
  max: API_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDevEnv,
});

module.exports = { apiLimiter };
