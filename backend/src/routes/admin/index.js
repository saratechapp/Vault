const express = require('express');
const { requireAdminAuth } = require('../../middleware/adminAuth');
const adminDb = require('../../adminDb');
const dashboardRoutes = require('./dashboard');
const usersRoutes = require('./users');
const adminsRoutes = require('./admins');
const rbacRoutes = require('./rbac');
const feedbackRoutes = require('./feedback');
const impersonationRoutes = require('./impersonation');
const notificationsRoutes = require('./notifications');
const subscriptionsRoutes = require('./subscriptions');

const router = express.Router();

// Every /api/admin/* route requires a valid admin session — applied once
// here rather than per-route, matching the plan's design.
router.use(requireAdminAuth);

router.get('/me', (req, res) => {
  res.json({
    id: req.admin.id,
    name: req.admin.name,
    email: req.adminEmail,
    roleId: req.admin.roleId,
    roleName: req.admin.roleName,
    isSuperAdmin: req.admin.isSuperAdmin,
    permissions: req.admin.isSuperAdmin ? 'all' : Array.from(req.admin.permissions),
  });
});

router.get('/audit-log', async (req, res, next) => {
  try {
    if (!req.admin.isSuperAdmin && !req.admin.permissions.has('auditLogs:view')) {
      return res.status(403).json({ error: 'forbidden' });
    }
    const logs = await adminDb.listAuditLog({
      targetType: req.query.targetType || undefined,
      targetId: req.query.targetId || undefined,
      adminId: req.query.adminId || undefined,
    });
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

router.use('/dashboard', dashboardRoutes);
router.use('/users', usersRoutes);
router.use('/admins', adminsRoutes);
router.use('/rbac', rbacRoutes);
router.use('/feedback', feedbackRoutes);
router.use('/impersonation', impersonationRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/subscriptions', subscriptionsRoutes);

module.exports = router;
