// Express 4 doesn't forward a rejected promise from an async handler to the
// error-handling middleware on its own. Same helper as the inline `ah()` in
// server.js, extracted so the new backend/routes/admin/* modules (which
// aren't part of server.js) can use the identical pattern instead of each
// redefining it.
function ah(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { ah };
