const express = require('express');
const adminDb = require('../../adminDb');
const adminPermissions = require('../../adminPermissions');
const { requirePermission } = require('../../middleware/adminAuth');
const { recordAudit } = require('../../lib/adminAudit');
const { ah } = require('../../lib/asyncHandler');

const router = express.Router();

// Static catalog the RBAC editor renders its checkbox grid from.
router.get('/permissions-catalog', requirePermission('rbac', 'view'), (req, res) => {
  res.json({ modules: adminPermissions.MODULES, catalog: adminPermissions.catalog() });
});

router.get('/roles', requirePermission('rbac', 'view'), ah(async (req, res) => {
  res.json(await adminDb.listRoles());
}));

router.get('/roles/:id', requirePermission('rbac', 'view'), ah(async (req, res) => {
  const role = await adminDb.getRole(req.params.id);
  if (!role) return res.status(404).json({ error: 'not_found' });
  const permissions = await adminDb.getRolePermissions(req.params.id);
  res.json({ ...role, permissions });
}));

router.post('/roles', requirePermission('rbac', 'edit'), ah(async (req, res) => {
  const { name, description } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name_required' });
  const role = await adminDb.createRole({ name, description });
  await recordAudit({ req, action: 'rbac.role.create', targetType: 'admin_role', targetId: role.id, after: role });
  res.status(201).json(role);
}));

router.patch('/roles/:id', requirePermission('rbac', 'edit'), ah(async (req, res) => {
  const before = await adminDb.getRole(req.params.id);
  if (!before) return res.status(404).json({ error: 'not_found' });
  if (before.isSystem) return res.status(400).json({ error: 'system_role_immutable' });
  const { name, description } = req.body || {};
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (description !== undefined) patch.description = description;
  const after = await adminDb.updateRole(req.params.id, patch);
  await recordAudit({ req, action: 'rbac.role.edit', targetType: 'admin_role', targetId: req.params.id, before, after });
  res.json(after);
}));

router.delete('/roles/:id', requirePermission('rbac', 'edit'), ah(async (req, res) => {
  const before = await adminDb.getRole(req.params.id);
  if (!before) return res.status(404).json({ error: 'not_found' });
  if (before.isSystem) return res.status(400).json({ error: 'system_role_immutable' });
  await adminDb.deleteRole(req.params.id);
  await recordAudit({ req, action: 'rbac.role.delete', targetType: 'admin_role', targetId: req.params.id, before, after: null });
  res.status(204).end();
}));

// Replace-all: the editor always submits the full desired permission set.
// Every (module, action) pair is validated against the static catalog first
// — rejecting unknown keys prevents privilege-escalation-by-typo.
router.put('/roles/:id/permissions', requirePermission('rbac', 'edit'), ah(async (req, res) => {
  const role = await adminDb.getRole(req.params.id);
  if (!role) return res.status(404).json({ error: 'not_found' });
  if (role.isSystem) return res.status(400).json({ error: 'system_role_immutable' });
  const pairs = Array.isArray(req.body?.permissions) ? req.body.permissions : [];
  const invalid = pairs.find(({ module, action }) => !adminPermissions.isValidPair(module, action));
  if (invalid) return res.status(400).json({ error: 'invalid_permission', permission: invalid });

  const before = await adminDb.getRolePermissions(req.params.id);
  await adminDb.setRolePermissions(req.params.id, pairs);
  await recordAudit({ req, action: 'rbac.role.set_permissions', targetType: 'admin_role', targetId: req.params.id, before, after: pairs });
  res.json({ ok: true, permissions: pairs });
}));

module.exports = router;
