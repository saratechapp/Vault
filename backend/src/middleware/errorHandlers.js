// 404 + error handling — must be registered last in the middleware chain.

function notFound(req, res) {
  res.status(404).json({ error: 'not found' });
}

// eslint-disable-next-line no-unused-vars
function jsonErrorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ error: 'invalid JSON body' });
  }
  console.error('[unhandled error]', err);
  res.status(500).json({ error: 'internal server error' });
}

module.exports = { notFound, jsonErrorHandler };
