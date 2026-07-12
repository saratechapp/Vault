// Admin-panel auth boundary. Deliberately NOT a wrapper around the consumer
// app's requireAuth (backend/server.js) — that middleware also loads a
// user's full wallet bundle (db.getUserBundle: every account/transaction/
// budget/etc, plus an auto-post catch-up sweep) on every request, which is
// the wrong shape and cost for an admin session. This only reuses the token
// -verification step and adds the admin-specific lookup on top.
const { supabase } = require('../supabaseClient');

async function requireAdminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'unauthorized' });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: 'unauthorized' });

    const { data: adminRow, error: adminErr } = await supabase
      .from('admins')
      .select('id, name, status, role_id, admin_roles(id, name, is_system)')
      .eq('id', data.user.id)
      .maybeSingle();
    if (adminErr) throw adminErr;
    // No `admins` row = this is a regular customer account, not staff — the
    // same Supabase Auth pool is shared on purpose (see plan doc), so this
    // check is the entire boundary between "customer" and "admin".
    if (!adminRow) return res.status(403).json({ error: 'not_an_admin' });
    if (adminRow.status !== 'active') return res.status(403).json({ error: 'admin_suspended' });

    const isSuperAdmin = !!adminRow.admin_roles?.is_system;
    let permissions = new Set();
    if (!isSuperAdmin) {
      const { data: permRows, error: permErr } = await supabase
        .from('admin_role_permissions')
        .select('module, action')
        .eq('role_id', adminRow.role_id);
      if (permErr) throw permErr;
      permissions = new Set((permRows || []).map((p) => `${p.module}:${p.action}`));
    }

    req.admin = {
      id: adminRow.id,
      name: adminRow.name,
      roleId: adminRow.role_id,
      roleName: adminRow.admin_roles?.name || null,
      isSuperAdmin,
      permissions,
    };
    req.adminEmail = data.user.email;
    next();
  } catch (err) {
    next(err);
  }
}

// Runs on reads too, not just writes — for this panel, role is itself an
// authorization boundary (e.g. Support Admin can see Feedback but not
// Users), unlike the consumer app where ownership is the only boundary.
function requirePermission(module, action) {
  return (req, res, next) => {
    if (!req.admin) return res.status(401).json({ error: 'unauthorized' });
    if (req.admin.isSuperAdmin || req.admin.permissions.has(`${module}:${action}`)) return next();
    return res.status(403).json({ error: 'forbidden' });
  };
}

module.exports = { requireAdminAuth, requirePermission };
