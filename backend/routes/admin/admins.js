const express = require('express');
const { supabase } = require('../../supabaseClient');
const adminDb = require('../../adminDb');
const { requirePermission } = require('../../middleware/adminAuth');
const { recordAudit } = require('../../lib/adminAudit');
const { ah } = require('../../lib/asyncHandler');

const router = express.Router();

router.get('/', requirePermission('admins', 'view'), ah(async (req, res) => {
  res.json(await adminDb.listAdmins());
}));

router.get('/:id', requirePermission('admins', 'view'), ah(async (req, res) => {
  const admin = await adminDb.getAdmin(req.params.id);
  if (!admin) return res.status(404).json({ error: 'not_found' });
  res.json(admin);
}));

// Provisions a brand-new admin: invites them into the shared Supabase Auth
// pool (no public admin signup exists, or should ever exist) and only then
// creates the `admins` row that actually grants panel access — a person can
// exist in auth.users with no `admins` row (a regular customer) forever.
router.post('/', requirePermission('admins', 'create'), ah(async (req, res) => {
  const { email, name, department, phone, roleId } = req.body || {};
  if (!email || !roleId) return res.status(400).json({ error: 'email_and_role_required' });

  const role = await adminDb.getRole(roleId);
  if (!role) return res.status(400).json({ error: 'invalid_role' });

  const { data: invited, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(email);
  if (inviteErr) throw inviteErr;

  const created = await adminDb.createAdmin({
    id: invited.user.id, name, department, phone, roleId, createdBy: req.admin.id,
  });
  await recordAudit({ req, action: 'admin.create', targetType: 'admin', targetId: created.id, after: created });
  res.status(201).json({ ...created, roleName: role.name });
}));

router.patch('/:id', requirePermission('admins', 'edit'), ah(async (req, res) => {
  const before = await adminDb.getAdmin(req.params.id);
  if (!before) return res.status(404).json({ error: 'not_found' });
  const { name, department, phone, avatar, roleId, status } = req.body || {};
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (department !== undefined) patch.department = department;
  if (phone !== undefined) patch.phone = phone;
  if (avatar !== undefined) patch.avatar = avatar;
  if (roleId !== undefined) patch.roleId = roleId;
  if (status !== undefined) patch.status = status;
  const after = await adminDb.updateAdmin(req.params.id, patch);
  await recordAudit({ req, action: 'admin.edit', targetType: 'admin', targetId: req.params.id, before, after });
  res.json(after);
}));

router.delete('/:id', requirePermission('admins', 'delete'), ah(async (req, res) => {
  const before = await adminDb.getAdmin(req.params.id);
  if (!before) return res.status(404).json({ error: 'not_found' });
  if (req.admin.id === before.id) {
    // An admin can never delete their own row — prevents an accidental
    // (or coerced) total panel lockout with no one left to undo it.
    return res.status(400).json({ error: 'cannot_delete_self' });
  }
  await adminDb.deleteAdmin(req.params.id);
  await recordAudit({ req, action: 'admin.delete', targetType: 'admin', targetId: req.params.id, before, after: null });
  res.status(204).end();
}));

module.exports = router;
