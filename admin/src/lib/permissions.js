// Mirrors backend/adminPermissions.js's shape on the client side. This is a
// UX convenience only (hides nav items / disables buttons a role can't
// use) — every route is independently re-checked server-side via
// requirePermission, since a client-side check can always be bypassed.
export function hasPermission(admin, module, action) {
  if (!admin) return false;
  if (admin.isSuperAdmin) return true;
  if (admin.permissions === 'all') return true;
  return Array.isArray(admin.permissions) && admin.permissions.includes(`${module}:${action}`);
}
