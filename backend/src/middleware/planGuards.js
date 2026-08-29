// Plan enforcement — thin wrappers around plans.js, the single source of
// truth for what each plan allows. Nowhere else should compare a plan name
// or a limit number directly.
const plans = require('../plans');

function requireFeature(flag) {
  return (req, res, next) => {
    if (!plans.can(req.userPlan, flag)) {
      return res.status(403).json({ error: 'upgrade_required', feature: flag });
    }
    next();
  };
}

// Used inline (not as middleware) right before an insert, since the current
// count of the resource is already sitting in req.userData from requireAuth
// — no extra query needed. Sends the 403 itself; caller just checks the
// return value and stops if false.
function assertUnderLimit(req, res, limitKey, currentCount) {
  const limit = plans.limitFor(req.userPlan, limitKey);
  if (currentCount >= limit) {
    res.status(403).json({ error: 'upgrade_required', limit: limitKey });
    return false;
  }
  return true;
}

module.exports = { requireFeature, assertUnderLimit };
