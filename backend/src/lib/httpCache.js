// Response cache-busting — `etagBase` is bumped whenever any write happens,
// so sendJSON's ETag changes and clients don't get a stale 304 for data that
// just changed, and so the per-user compute cache (services/cache.js)
// invalidates the health-score/AI-insights/AI-monthly-report bundles it may
// have cached for this user. bumpCache is called at the end of every mutating
// route with req.userId.
//
// This module owns the single mutable `etagBase` — Node's module cache
// guarantees one instance, so bumpCache (the writer) and sendJSON (the
// reader) always share the same value. Never re-declare etagBase elsewhere.
const crypto = require('crypto');
const insightsCache = require('../services/cache');

let etagBase = Date.now();

function bumpCache(userId) {
  etagBase = Date.now();
  insightsCache.touch(userId);
}

function sendJSON(req, res, payload) {
  const key = `${etagBase}:${req.userId || 'anon'}:${req.originalUrl}`;
  const etag = 'W/"' + crypto.createHash('sha1').update(key).digest('hex') + '"';
  res.set('Cache-Control', 'private, no-cache');
  res.set('ETag', etag);
  if (req.headers['if-none-match'] === etag) {
    res.status(304).end();
    return;
  }
  res.json(payload);
}

module.exports = { bumpCache, sendJSON };
