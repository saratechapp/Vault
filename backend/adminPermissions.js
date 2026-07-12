// Static RBAC catalog for the admin panel — single source of truth for which
// (module, action) pairs exist, same "config file owns the shape, DB only
// stores selection" philosophy as plans.js. admin_role_permissions rows are
// validated against this list on every write (backend/routes/admin/rbac.js)
// so a typo can never silently grant a nonexistent permission, and the admin
// UI's RBAC editor renders its checkbox grid straight off this module.
//
// Super Admin is not represented here — it bypasses permission checks
// entirely (see middleware/adminAuth.js), so it can never be accidentally
// under-seeded and lose access to its own panel.

const MODULES = {
  dashboard: { label: 'Dashboard', actions: ['view'] },
  users: { label: 'Users', actions: ['view', 'edit', 'suspend', 'delete', 'impersonate', 'export'] },
  admins: { label: 'Admins', actions: ['view', 'create', 'edit', 'delete'] },
  rbac: { label: 'Roles & Permissions', actions: ['view', 'edit'] },
  feedback: { label: 'Feedback', actions: ['view', 'edit', 'assign', 'delete'] },
  auditLogs: { label: 'Audit Logs', actions: ['view'] },
};

const VALID_PAIRS = new Set();
Object.entries(MODULES).forEach(([module, { actions }]) => {
  actions.forEach((action) => VALID_PAIRS.add(`${module}:${action}`));
});

function isValidPair(module, action) {
  return VALID_PAIRS.has(`${module}:${action}`);
}

// Flat [{ module, action }] list — convenient for the RBAC editor UI and for
// validating a bulk permission-set write in one pass.
function catalog() {
  return Object.entries(MODULES).flatMap(([module, { actions }]) => actions.map((action) => ({ module, action })));
}

module.exports = { MODULES, isValidPair, catalog };
