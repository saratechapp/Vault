// 404 + error handling — must be registered last in the middleware chain.

function notFound(req, res) {
  res.status(404).json({ error: 'not found' });
}

// eslint-disable-next-line no-unused-vars
function jsonErrorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ error: 'invalid JSON body' });
  }
  // An error carrying an explicit 4xx status (e.g. db.js upsert() rejecting a
  // client-supplied id that belongs to another user) is surfaced as-is
  // rather than masked as a 500. Nothing reaching here set `status` before
  // the offline-sync work, so existing behaviour is unchanged.
  const explicit = Number(err.status || err.statusCode);
  if (Number.isInteger(explicit) && explicit >= 400 && explicit < 500) {
    return res.status(explicit).json({ error: err.message || 'request failed' });
  }
  console.error('[unhandled error]', err);
  res.status(500).json({ error: 'internal server error' });
}

module.exports = { notFound, jsonErrorHandler };
