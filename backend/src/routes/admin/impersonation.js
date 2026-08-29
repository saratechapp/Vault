// Starting an impersonation session lives in users.js (POST /:id/impersonate)
// since it's fundamentally a per-user action. This file covers oversight: a
// Super Admin can see every currently-active impersonation across all
// admins and forcibly end one — the "revocable" half of the security design
// in the plan doc (ending here can't invalidate the already-issued Supabase
// JWT by itself, so the consumer app also calls supabase.auth.signOut() on
// its own exit path).
const express = require('express');
const { supabase } = require('../../supabaseClient');
const adminDb = require('../../adminDb');
const { requirePermission } = require('../../middleware/adminAuth');
const { recordAudit } = require('../../lib/adminAudit');
const { ah } = require('../../lib/asyncHandler');

const router = express.Router();

router.get('/active', requirePermission('users', 'impersonate'), ah(async (req, res) => {
  const { data, error } = await supabase
    .from('impersonation_sessions')
    .select('*, admins(id, name)')
    .is('ended_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('started_at', { ascending: false });
  if (error) throw error;
  res.json((data || []).map((row) => ({
    id: row.id, adminId: row.admin_id, adminName: row.admins?.name || null, targetUserId: row.target_user_id,
    startedAt: row.started_at, expiresAt: row.expires_at, reason: row.reason,
  })));
}));

router.post('/:id/revoke', requirePermission('users', 'impersonate'), ah(async (req, res) => {
  if (!req.admin.isSuperAdmin) return res.status(403).json({ error: 'forbidden' });
  await adminDb.endImpersonationSession(req.params.id, 'revoked');
  await recordAudit({ req, action: 'user.impersonate.revoke', targetType: 'impersonation_session', targetId: req.params.id });
  res.json({ ok: true });
}));

module.exports = router;
