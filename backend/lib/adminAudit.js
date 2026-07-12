// Called explicitly at the end of every mutating admin route handler — same
// "developer must remember to call it" shape as server.js's bumpCache(userId)
// pattern already used after every mutating consumer route, not a new
// convention invented for this feature.
const adminDb = require('../adminDb');

async function recordAudit({ req, action, targetType, targetId, before, after }) {
  const admin = req.admin;
  try {
    await adminDb.writeAuditLog({
      adminId: admin?.id || null,
      action,
      targetType: targetType || null,
      targetId: targetId || null,
      before: before ?? null,
      after: after ?? null,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || null,
    });
  } catch (err) {
    // Never let an audit-log write failure break the underlying admin
    // action that already succeeded — log loudly instead so it's visible
    // in server logs even though the mutation itself completed.
    // eslint-disable-next-line no-console
    console.error('[admin-audit] failed to record', action, err);
  }
}

module.exports = { recordAudit };
