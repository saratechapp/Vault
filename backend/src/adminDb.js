// Cross-user query helpers for the admin panel — the counterpart to db.js,
// which is deliberately scoped to one user's own data. Everything here can
// read/write across users, so every caller MUST come through
// requireAdminAuth + requirePermission (backend/middleware/adminAuth.js);
// nothing in this file re-checks authorization itself.
const { supabase } = require('./supabaseClient');
const { rowToCamel, rowsToCamel, camelToSnakePatch } = require('./lib/supabaseMapper');
const { updateProfile: updateUserProfile, getProfile: getUserProfile, PROFILE_FIELDS } = require('./db');

const ADMIN_FIELDS = [
  ['id', 'id'], ['name', 'name'], ['department', 'department'], ['phone', 'phone'], ['avatar', 'avatar'],
  ['role_id', 'roleId'], ['status', 'status'], ['created_by', 'createdBy'],
  ['created_at', 'createdAt'], ['updated_at', 'updatedAt'],
];
const ROLE_FIELDS = [
  ['id', 'id'], ['name', 'name'], ['description', 'description'], ['is_system', 'isSystem'], ['created_at', 'createdAt'],
];
const AUDIT_FIELDS = [
  ['id', 'id'], ['admin_id', 'adminId'], ['action', 'action'], ['target_type', 'targetType'], ['target_id', 'targetId'],
  ['before', 'before'], ['after', 'after'], ['ip', 'ip'], ['user_agent', 'userAgent'], ['created_at', 'createdAt'],
];
const IMPERSONATION_FIELDS = [
  ['id', 'id'], ['admin_id', 'adminId'], ['target_user_id', 'targetUserId'], ['reason', 'reason'],
  ['started_at', 'startedAt'], ['expires_at', 'expiresAt'], ['ended_at', 'endedAt'], ['ended_reason', 'endedReason'],
  ['ip', 'ip'], ['user_agent', 'userAgent'],
];
const LOGIN_EVENT_FIELDS = [
  ['id', 'id'], ['user_id', 'userId'], ['event_type', 'eventType'], ['method', 'method'],
  ['ip', 'ip'], ['user_agent', 'userAgent'], ['device', 'device'], ['created_at', 'createdAt'],
];
const FEEDBACK_FIELDS = [
  ['id', 'id'], ['user_id', 'userId'], ['user_email', 'userEmail'], ['user_name', 'userName'], ['category', 'category'],
  ['subject', 'subject'], ['message', 'message'], ['status', 'status'], ['priority', 'priority'],
  ['assigned_admin_id', 'assignedAdminId'], ['platform', 'platform'], ['app_version', 'appVersion'],
  ['rating', 'rating'], ['satisfaction_rating', 'satisfactionRating'], ['resolved_at', 'resolvedAt'],
  ['closed_at', 'closedAt'], ['user_last_read_at', 'userLastReadAt'], ['admin_last_read_at', 'adminLastReadAt'],
  ['created_at', 'createdAt'], ['updated_at', 'updatedAt'],
];
const FEEDBACK_MESSAGE_FIELDS = [
  ['id', 'id'], ['feedback_id', 'feedbackId'], ['sender_type', 'senderType'], ['user_sender_id', 'userSenderId'],
  ['admin_sender_id', 'adminSenderId'], ['body', 'body'], ['internal', 'internal'], ['created_at', 'createdAt'],
];

// ---------------------------------------------------------------------------
// Roles & permissions
// ---------------------------------------------------------------------------
async function listRoles() {
  const { data, error } = await supabase.from('admin_roles').select('*').order('name');
  if (error) throw error;
  return rowsToCamel(data, ROLE_FIELDS);
}
async function getRole(id) {
  const { data, error } = await supabase.from('admin_roles').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return rowToCamel(data, ROLE_FIELDS);
}
async function createRole({ name, description }) {
  const { data, error } = await supabase.from('admin_roles').insert({ name, description: description || '' }).select().single();
  if (error) throw error;
  return rowToCamel(data, ROLE_FIELDS);
}
async function updateRole(id, patch) {
  const row = camelToSnakePatch(patch, ROLE_FIELDS);
  const { data, error } = await supabase.from('admin_roles').update(row).eq('id', id).eq('is_system', false).select().maybeSingle();
  if (error) throw error;
  return data ? rowToCamel(data, ROLE_FIELDS) : null;
}
async function deleteRole(id) {
  // is_system=false guard means the built-in roles (Super Admin included)
  // can never be deleted through this path, even if a caller bypassed the
  // route-level check.
  const { error } = await supabase.from('admin_roles').delete().eq('id', id).eq('is_system', false);
  if (error) throw error;
}
async function getRolePermissions(roleId) {
  const { data, error } = await supabase.from('admin_role_permissions').select('module, action').eq('role_id', roleId);
  if (error) throw error;
  return data || [];
}
// Replace-all semantics: the RBAC editor always submits the full desired
// permission set for a role, not an incremental diff.
async function setRolePermissions(roleId, pairs) {
  const { error: delErr } = await supabase.from('admin_role_permissions').delete().eq('role_id', roleId);
  if (delErr) throw delErr;
  if (!pairs.length) return;
  const rows = pairs.map(({ module, action }) => ({ role_id: roleId, module, action }));
  const { error } = await supabase.from('admin_role_permissions').insert(rows);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Admins
// ---------------------------------------------------------------------------
async function listAdmins() {
  const { data, error } = await supabase
    .from('admins')
    .select('*, admin_roles(id, name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({ ...rowToCamel(row, ADMIN_FIELDS), roleName: row.admin_roles?.name || null }));
}
// Cheap PK lookup used by the consumer app (server.js requireAuth) to decide
// whether to show the "Super Admin" button in the topbar — not an
// authorization check itself (every /api/admin/* route still independently
// verifies via requireAdminAuth), just a UI-visibility signal.
async function isActiveAdmin(userId) {
  const { data, error } = await supabase.from('admins').select('id').eq('id', userId).eq('status', 'active').maybeSingle();
  if (error) throw error;
  return !!data;
}

async function getAdmin(id) {
  const { data, error } = await supabase.from('admins').select('*, admin_roles(id, name)').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...rowToCamel(data, ADMIN_FIELDS), roleName: data.admin_roles?.name || null };
}
// `id` must already exist in auth.users — provisioning (inviting the person
// into Supabase Auth) happens in the route handler via supabase.auth.admin,
// this only creates the `admins` row that actually grants access.
async function createAdmin({ id, name, department, phone, avatar, roleId, createdBy }) {
  const { data, error } = await supabase
    .from('admins')
    .insert({ id, name: name || '', department: department || '', phone: phone || '', avatar: avatar || '', role_id: roleId, created_by: createdBy || null })
    .select()
    .single();
  if (error) throw error;
  return rowToCamel(data, ADMIN_FIELDS);
}
async function updateAdmin(id, patch) {
  const row = camelToSnakePatch(patch, ADMIN_FIELDS);
  row.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from('admins').update(row).eq('id', id).select().maybeSingle();
  if (error) throw error;
  return data ? rowToCamel(data, ADMIN_FIELDS) : null;
}
async function deleteAdmin(id) {
  const { error } = await supabase.from('admins').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Users (cross-user, admin-side view of the same `profiles` table db.js
// scopes per-user) — reuses db.js's getProfile/updateProfile directly since
// it's the same table and field convention, not a parallel one.
// ---------------------------------------------------------------------------
// PostgREST's `.or()` takes a raw filter expression. Interpolating an
// unescaped search string into it lets `,` `(` `)` `"` break out of the
// intended name/phone/email match and inject arbitrary PostgREST filters
// (a low-privilege admin widening what they can see, or forcing errors).
// Strip every character that isn't plausibly part of a person's name,
// phone or email, collapse whitespace, and cap the length. `*` / `%` are
// dropped too so a caller can't turn the search into a full-table LIKE
// wildcard scan.
function sanitizeOrSearchTerm(raw) {
  return String(raw || '')
    .replace(/[,()"'\\*%:<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

async function listUsers({ page = 1, pageSize = 25, search = '', status = '', plan = '' } = {}) {
  let query = supabase.from('profiles').select('*', { count: 'exact' });
  const safeSearch = sanitizeOrSearchTerm(search);
  if (safeSearch) query = query.or(`name.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%`);
  if (status) query = query.eq('status', status);
  if (plan) query = query.eq('plan', plan);
  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.order('member_since', { ascending: false }).range(from, from + pageSize - 1);
  if (error) throw error;
  return { rows: rowsToCamel(data, PROFILE_FIELDS), total: count || 0 };
}

// ---------------------------------------------------------------------------
// Login events
// ---------------------------------------------------------------------------
async function recordLoginEvent({ userId, method, ip, userAgent, device, eventType = 'login' }) {
  const { error } = await supabase.from('login_events').insert({
    user_id: userId, method, ip, user_agent: userAgent, device, event_type: eventType,
  });
  if (error) throw error;
}
async function listLoginEvents(userId, limit = 50) {
  const { data, error } = await supabase
    .from('login_events').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return rowsToCamel(data, LOGIN_EVENT_FIELDS);
}

// ---------------------------------------------------------------------------
// Impersonation
// ---------------------------------------------------------------------------
async function createImpersonationSession({ adminId, targetUserId, reason, ip, userAgent, ttlMs = 15 * 60 * 1000 }) {
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  const { data, error } = await supabase
    .from('impersonation_sessions')
    .insert({ admin_id: adminId, target_user_id: targetUserId, reason: reason || null, expires_at: expiresAt, ip, user_agent: userAgent })
    .select()
    .single();
  if (error) throw error;
  return rowToCamel(data, IMPERSONATION_FIELDS);
}
// The one active (unexpired, unended) session for a user, if any — checked
// by requireAuth on every request while impersonation is possibly active.
async function getActiveImpersonationSession(targetUserId) {
  const { data, error } = await supabase
    .from('impersonation_sessions')
    .select('*, admins(id, name)')
    .eq('target_user_id', targetUserId)
    .is('ended_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...rowToCamel(data, IMPERSONATION_FIELDS), adminName: data.admins?.name || null };
}
async function endImpersonationSession(id, endedReason) {
  const { error } = await supabase
    .from('impersonation_sessions')
    .update({ ended_at: new Date().toISOString(), ended_reason: endedReason })
    .eq('id', id)
    .is('ended_at', null);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------
async function writeAuditLog({ adminId, action, targetType, targetId, before, after, ip, userAgent }) {
  const { error } = await supabase.from('admin_audit_log').insert({
    admin_id: adminId, action, target_type: targetType || null, target_id: targetId || null,
    before: before ?? null, after: after ?? null, ip, user_agent: userAgent,
  });
  if (error) throw error;
}
async function listAuditLog({ targetType, targetId, adminId, limit = 100 } = {}) {
  let query = supabase.from('admin_audit_log').select('*, admins(id, name)').order('created_at', { ascending: false }).limit(limit);
  if (targetType) query = query.eq('target_type', targetType);
  if (targetId) query = query.eq('target_id', targetId);
  if (adminId) query = query.eq('admin_id', adminId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => ({ ...rowToCamel(row, AUDIT_FIELDS), adminName: row.admins?.name || null }));
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------
async function createFeedback(entry) {
  const row = camelToSnakePatch(entry, FEEDBACK_FIELDS);
  const { data, error } = await supabase.from('feedback').insert(row).select().single();
  if (error) throw error;
  return rowToCamel(data, FEEDBACK_FIELDS);
}
async function listFeedback({ page = 1, pageSize = 25, status = '', priority = '', category = '', assignedAdminId = '', userId = '' } = {}) {
  let query = supabase.from('feedback').select('*', { count: 'exact' });
  if (status) query = query.eq('status', status);
  if (priority) query = query.eq('priority', priority);
  if (category) query = query.eq('category', category);
  if (assignedAdminId) query = query.eq('assigned_admin_id', assignedAdminId);
  // Consumer routes pass their own userId so a user only ever lists their own
  // tickets — the admin routes never pass this, giving them the full inbox.
  if (userId) query = query.eq('user_id', userId);
  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, from + pageSize - 1);
  if (error) throw error;
  return { rows: rowsToCamel(data, FEEDBACK_FIELDS), total: count || 0 };
}
async function getFeedback(id) {
  const { data, error } = await supabase.from('feedback').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return rowToCamel(data, FEEDBACK_FIELDS);
}
async function updateFeedback(id, patch) {
  const row = camelToSnakePatch(patch, FEEDBACK_FIELDS);
  row.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from('feedback').update(row).eq('id', id).select().maybeSingle();
  if (error) throw error;
  return data ? rowToCamel(data, FEEDBACK_FIELDS) : null;
}
async function deleteFeedback(id) {
  const { error } = await supabase.from('feedback').delete().eq('id', id);
  if (error) throw error;
}
async function addFeedbackMessage(entry) {
  const row = camelToSnakePatch(entry, FEEDBACK_MESSAGE_FIELDS);
  const { data, error } = await supabase.from('feedback_messages').insert(row).select().single();
  if (error) throw error;
  return rowToCamel(data, FEEDBACK_MESSAGE_FIELDS);
}
async function listFeedbackMessages(feedbackId, { includeInternal = true } = {}) {
  let query = supabase.from('feedback_messages').select('*').eq('feedback_id', feedbackId).order('created_at', { ascending: true });
  if (!includeInternal) query = query.eq('internal', false);
  const { data, error } = await query;
  if (error) throw error;
  return rowsToCamel(data, FEEDBACK_MESSAGE_FIELDS);
}
// Just the newest visible message for a ticket — cheap enough to call once
// per open ticket when building the "support replied" notification, without
// pulling every message in the thread.
async function getLatestFeedbackMessage(feedbackId) {
  const { data, error } = await supabase
    .from('feedback_messages').select('*').eq('feedback_id', feedbackId).eq('internal', false)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data ? rowToCamel(data, FEEDBACK_MESSAGE_FIELDS) : null;
}
// Called whenever the owning user opens a ticket's conversation — drives the
// "support replied" generated notification in notificationEngine.js, which
// only fires while the latest visible admin message postdates this.
async function markFeedbackRead(id) {
  const { error } = await supabase.from('feedback').update({ user_last_read_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}
// Staff-side counterpart, called when an admin opens a ticket — drives the
// admin topbar's notification bell the same way markFeedbackRead drives the
// consumer "support replied" notification.
async function markFeedbackAdminRead(id) {
  const { error } = await supabase.from('feedback').update({ admin_last_read_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

module.exports = {
  listRoles, getRole, createRole, updateRole, deleteRole, getRolePermissions, setRolePermissions,
  listAdmins, getAdmin, isActiveAdmin, createAdmin, updateAdmin, deleteAdmin,
  listUsers, getUserProfile, updateUserProfile,
  recordLoginEvent, listLoginEvents,
  createImpersonationSession, getActiveImpersonationSession, endImpersonationSession,
  writeAuditLog, listAuditLog,
  createFeedback, listFeedback, getFeedback, updateFeedback, deleteFeedback, addFeedbackMessage, listFeedbackMessages,
  markFeedbackRead, markFeedbackAdminRead, getLatestFeedbackMessage,
};
