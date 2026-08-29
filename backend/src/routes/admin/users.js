const express = require('express');
const rateLimit = require('express-rate-limit');
const { supabase } = require('../../supabaseClient');
const db = require('../../db');
const adminDb = require('../../adminDb');
const { requirePermission } = require('../../middleware/adminAuth');
const { recordAudit } = require('../../lib/adminAudit');
const { ah } = require('../../lib/asyncHandler');

const router = express.Router();

// Impersonate/reset-password/force-logout are high-blast-radius actions —
// stricter than the blanket 300/15min limiter already applied to all of
// /api (server.js). This is net-new; no per-route limiter existed before
// this feature. Same explicit-opt-in dev skip as the blanket limiter (see
// server.js) — production behavior is unchanged.
const sensitiveActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'development',
});

router.get('/', requirePermission('users', 'view'), ah(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 25));
  const { rows, total } = await adminDb.listUsers({
    page, pageSize,
    search: req.query.search || '',
    status: req.query.status || '',
    plan: req.query.plan || '',
  });
  res.json({ rows, total, page, pageSize });
}));

router.get('/:id', requirePermission('users', 'view'), ah(async (req, res) => {
  const profile = await adminDb.getUserProfile(req.params.id);
  if (!profile) return res.status(404).json({ error: 'not_found' });
  let authUser = null;
  let mfaEnrolled = false;
  try {
    const { data } = await supabase.auth.admin.getUserById(req.params.id);
    authUser = data?.user || null;
    // supabase-js v2: admin.mfa.listFactors({ userId }) — best-effort; MFA
    // status shouldn't block loading the rest of the profile if it fails.
    if (authUser) {
      const { data: factors } = await supabase.auth.admin.mfa.listFactors({ userId: req.params.id });
      mfaEnrolled = (factors?.factors || []).some((f) => f.status === 'verified');
    }
  } catch {
    // best-effort — Auth admin lookups shouldn't 500 the whole profile view
  }
  res.json({
    ...profile,
    email: authUser?.email || null,
    lastSignInAt: authUser?.last_sign_in_at || null,
    createdAt: authUser?.created_at || null,
    mfaEnrolled,
  });
}));

// Read-only drill-down into the user's actual wallet data — reuses
// db.getUserBundle exactly as a normal `requireAuth` request would.
router.get('/:id/data', requirePermission('users', 'view'), ah(async (req, res) => {
  const bundle = await db.getUserBundle(req.params.id);
  res.json(bundle);
}));

router.get('/:id/logins', requirePermission('users', 'view'), ah(async (req, res) => {
  const events = await adminDb.listLoginEvents(req.params.id);
  res.json(events);
}));

router.patch('/:id', requirePermission('users', 'edit'), ah(async (req, res) => {
  const before = await adminDb.getUserProfile(req.params.id);
  if (!before) return res.status(404).json({ error: 'not_found' });
  const { name, phone, currency, currencySymbol, country } = req.body || {};
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (phone !== undefined) patch.phone = phone;
  if (currency !== undefined) patch.currency = currency;
  if (currencySymbol !== undefined) patch.currencySymbol = currencySymbol;
  if (country !== undefined) patch.country = country;
  const after = await adminDb.updateUserProfile(req.params.id, patch);
  await recordAudit({ req, action: 'user.edit', targetType: 'user', targetId: req.params.id, before, after });
  res.json(after);
}));

router.post('/:id/suspend', requirePermission('users', 'suspend'), ah(async (req, res) => {
  const before = await adminDb.getUserProfile(req.params.id);
  if (!before) return res.status(404).json({ error: 'not_found' });
  const after = await adminDb.updateUserProfile(req.params.id, { status: 'suspended' });
  await recordAudit({ req, action: 'user.suspend', targetType: 'user', targetId: req.params.id, before, after });
  res.json(after);
}));

router.post('/:id/activate', requirePermission('users', 'suspend'), ah(async (req, res) => {
  const before = await adminDb.getUserProfile(req.params.id);
  if (!before) return res.status(404).json({ error: 'not_found' });
  const after = await adminDb.updateUserProfile(req.params.id, { status: 'active' });
  await recordAudit({ req, action: 'user.activate', targetType: 'user', targetId: req.params.id, before, after });
  res.json(after);
}));

router.delete('/:id', requirePermission('users', 'delete'), ah(async (req, res) => {
  const before = await adminDb.getUserProfile(req.params.id);
  if (!before) return res.status(404).json({ error: 'not_found' });
  // Deletes the auth.users row; every owned table (profiles, accounts,
  // transactions, ...) cascades via `on delete cascade`, same as the
  // existing schema already guarantees for account closure.
  const { error } = await supabase.auth.admin.deleteUser(req.params.id);
  if (error) throw error;
  await recordAudit({ req, action: 'user.delete', targetType: 'user', targetId: req.params.id, before, after: null });
  res.status(204).end();
}));

router.post('/:id/reset-password', sensitiveActionLimiter, requirePermission('users', 'edit'), ah(async (req, res) => {
  const { data: userData, error: getErr } = await supabase.auth.admin.getUserById(req.params.id);
  if (getErr || !userData?.user) return res.status(404).json({ error: 'not_found' });
  // Lands on the existing /reset-password flow (frontend/src/pages/ResetPassword.jsx)
  // — no new consumer-side page needed.
  const { error } = await supabase.auth.admin.generateLink({ type: 'recovery', email: userData.user.email });
  if (error) throw error;
  await recordAudit({ req, action: 'user.reset_password', targetType: 'user', targetId: req.params.id });
  res.json({ ok: true });
}));

router.post('/:id/force-logout', sensitiveActionLimiter, requirePermission('users', 'edit'), ah(async (req, res) => {
  const before = await adminDb.getUserProfile(req.params.id);
  if (!before) return res.status(404).json({ error: 'not_found' });
  // Authoritative mechanism: requireAuth rejects any JWT issued before this
  // timestamp (see server.js) — not dependent on an unverified Supabase
  // Admin SDK "sign out by user id" call.
  const after = await adminDb.updateUserProfile(req.params.id, { sessionsInvalidatedAt: new Date().toISOString() });
  await recordAudit({ req, action: 'user.force_logout', targetType: 'user', targetId: req.params.id, before, after });
  res.json({ ok: true });
}));

// Super Admin only, tightly scoped: 15-minute session, fully audited, and
// independently re-checked by requireAuth on every request while active
// (not just at login) — see plan doc's Security Checklist.
router.post('/:id/impersonate', sensitiveActionLimiter, requirePermission('users', 'impersonate'), ah(async (req, res) => {
  if (!req.admin.isSuperAdmin) return res.status(403).json({ error: 'forbidden' });
  const { data: userData, error: getErr } = await supabase.auth.admin.getUserById(req.params.id);
  if (getErr || !userData?.user) return res.status(404).json({ error: 'not_found' });

  const session = await adminDb.createImpersonationSession({
    adminId: req.admin.id,
    targetUserId: req.params.id,
    reason: req.body?.reason || null,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  // Magic link establishes the target user's *real* Supabase session client
  // -side — no hand-rolled JWT. The 15-minute expiry that actually matters
  // is impersonation_sessions.expires_at, enforced independently by
  // requireAuth, not this link's own TTL.
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: userData.user.email,
    options: { redirectTo: `${frontendUrl}/impersonate-entry?impersonation=1` },
  });
  if (linkErr) throw linkErr;

  await recordAudit({
    req, action: 'user.impersonate.start', targetType: 'user', targetId: req.params.id,
    after: { impersonationSessionId: session.id, expiresAt: session.expiresAt },
  });
  res.json({
    impersonationSessionId: session.id,
    expiresAt: session.expiresAt,
    actionLink: linkData?.properties?.action_link || null,
  });
}));

module.exports = router;
