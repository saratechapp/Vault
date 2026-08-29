const { supabase } = require('./supabaseClient');
const { rowToCamel, rowsToCamel, camelToSnakePatch } = require('./lib/supabaseMapper');

// ---------------------------------------------------------------------------
// field maps: [snake_case column, camelCase field] pairs per table. Shared by
// the row->camelCase mapper (reads) and the camelCase->snake_case patch
// builder (writes), so every insert/update/select stays byte-identical to
// the field names server.js already expects (cross-referenced against every
// read/write site in server.js, not guessed).
// ---------------------------------------------------------------------------
const CATEGORY_FIELDS = [
  ['id', 'id'], ['name', 'name'], ['icon', 'icon'], ['color', 'color'], ['parent_id', 'parentId'],
  ['type', 'type'], ['sort_order', 'sortOrder'],
];
const ACCOUNT_FIELDS = [
  ['id', 'id'], ['name', 'name'], ['type', 'type'], ['opening_balance', 'openingBalance'],
  ['color', 'color'], ['icon', 'icon'], ['currency', 'currency'], ['institution', 'institution'],
  ['credit_limit', 'creditLimit'], ['is_primary', 'isPrimary'],
];
const TRANSACTION_FIELDS = [
  ['id', 'id'], ['date', 'date'], ['vendor', 'vendor'], ['category_id', 'categoryId'], ['amount', 'amount'], ['type', 'type'],
  ['payment_method', 'paymentMethod'], ['note', 'note'], ['labels', 'labels'], ['payer', 'payer'], ['payment_status', 'paymentStatus'],
  ['currency', 'currency'], ['account_id', 'accountId'], ['from_account_id', 'fromAccountId'], ['to_account_id', 'toAccountId'],
  ['source_bill_id', 'sourceBillId'], ['source_debt_id', 'sourceDebtId'], ['goal_id', 'goalId'],
];
const BUDGET_FIELDS = [
  ['id', 'id'], ['category_id', 'categoryId'], ['limit', 'limit'], ['period', 'period'],
  ['alert_at', 'alertAt'], ['start_date', 'startDate'], ['end_date', 'endDate'],
];
const BILL_FIELDS = [
  ['id', 'id'], ['name', 'name'], ['type', 'type'], ['amount', 'amount'], ['due_date', 'dueDate'], ['frequency', 'frequency'],
  ['status', 'status'], ['category', 'category'], ['category_id', 'categoryId'], ['vendor', 'vendor'], ['payment_method', 'paymentMethod'],
  ['note', 'note'], ['labels', 'labels'], ['active', 'active'], ['last_run', 'lastRun'],
  ['account_id', 'accountId'], ['from_account_id', 'fromAccountId'], ['to_account_id', 'toAccountId'],
];
const GOAL_FIELDS = [
  ['id', 'id'], ['name', 'name'], ['icon', 'icon'], ['target', 'target'], ['saved', 'saved'], ['deadline', 'deadline'],
  ['priority', 'priority'], ['color', 'color'], ['monthly_contribution', 'monthlyContribution'], ['note', 'note'], ['account_id', 'accountId'],
];
const DEBT_FIELDS = [
  ['id', 'id'], ['name', 'name'], ['creditor', 'creditor'], ['balance', 'balance'], ['apr', 'apr'],
  ['min_payment', 'minPayment'], ['due_date', 'dueDate'],
];
const TEMPLATE_FIELDS = [
  ['id', 'id'], ['name', 'name'], ['type', 'type'], ['amount', 'amount'], ['category_id', 'categoryId'],
  ['account_id', 'accountId'], ['payment_method', 'paymentMethod'], ['vendor', 'vendor'], ['note', 'note'],
];
const PROFILE_FIELDS = [
  ['id', 'id'], ['name', 'name'], ['phone', 'phone'], ['avatar', 'avatar'], ['currency', 'currency'],
  ['currency_symbol', 'currencySymbol'], ['member_since', 'memberSince'], ['plan', 'plan'], ['health_score', 'healthScore'],
  ['health_grade', 'healthGrade'], ['two_factor_enabled', 'twoFactorEnabled'], ['biometric_enabled', 'biometricEnabled'],
  ['dashboard_layout', 'dashboardLayout'], ['has_password', 'hasPassword'], ['country', 'country'], ['status', 'status'],
  ['sessions_invalidated_at', 'sessionsInvalidatedAt'], ['email', 'email'],
  ['feedback_prompt_snoozed_until', 'feedbackPromptSnoozedUntil'], ['feedback_prompt_disabled', 'feedbackPromptDisabled'],
  ['date_of_birth', 'dateOfBirth'], ['timezone', 'timezone'],
  ['theme_mode', 'themeMode'], ['language', 'language'], ['week_start', 'weekStart'],
  ['time_format', 'timeFormat'], ['haptic_enabled', 'hapticEnabled'], ['reminder_settings', 'reminderSettings'],
];
// Sessions (mobile Settings > Security > Sessions) — one row per
// app-install/login, distinct from the append-only `login_events` history
// table (adminDb.js). See 0022_sessions.sql for why this is a separate table
// rather than reusing login_events or a Supabase-native session primitive.
const SESSION_FIELDS = [
  ['id', 'id'], ['session_id', 'sessionId'], ['platform', 'platform'], ['device_label', 'deviceLabel'],
  ['app_version', 'appVersion'], ['ip', 'ip'], ['created_at', 'createdAt'], ['last_seen_at', 'lastSeenAt'],
  ['revoked_at', 'revokedAt'], ['two_factor_verified_at', 'twoFactorVerifiedAt'],
];
// Email-OTP codes backing real 2FA (see 0023_two_factor_codes.sql) — never
// exposes code_hash to callers outside this module.
const TWO_FACTOR_CODE_FIELDS = [
  ['id', 'id'], ['purpose', 'purpose'], ['expires_at', 'expiresAt'],
  ['consumed_at', 'consumedAt'], ['attempts', 'attempts'], ['created_at', 'createdAt'],
];
// Every user-owned entity table, in delete order for Reset Data (children
// before/independent of parents — none of these FK to each other in a way
// that requires ordering, but bill_payments references bills so it goes
// first defensively) and the same table list getUserBundle() already reads.
const RESETTABLE_TABLES = [
  'bill_payments', 'transactions', 'budgets', 'bills', 'goals', 'debts', 'templates', 'accounts', 'categories',
];
// Payment-time log backing BillAnalysisService's payment-history/late-payment
// insights (see 0007_bill_payments.sql) — write-once per payment, read via
// getUserBundle like every other entity.
const BILL_PAYMENT_FIELDS = [
  ['id', 'id'], ['bill_id', 'billId'], ['transaction_id', 'transactionId'],
  ['due_date_at_payment', 'dueDateAtPayment'], ['paid_date', 'paidDate'], ['was_late', 'wasLate'],
];
// Ask AI conversations/messages (see 0018_ai_conversations.sql) — not part of
// getUserBundle since they aren't financial data the analytics services read;
// fetched on demand by the /api/ai/conversations* routes instead.
const CONVERSATION_FIELDS = [
  ['id', 'id'], ['title', 'title'], ['created_at', 'createdAt'],
  ['updated_at', 'updatedAt'], ['last_message_at', 'lastMessageAt'],
];
const MESSAGE_FIELDS = [
  ['id', 'id'], ['conversation_id', 'conversationId'], ['role', 'role'],
  ['content', 'content'], ['metadata', 'metadata'], ['created_at', 'createdAt'],
];

async function fetchAll(table, userId) {
  const { data, error } = await supabase.from(table).select('*').eq('user_id', userId);
  if (error) throw error;
  return data || [];
}

async function getUserBundle(userId) {
  const [categories, accounts, transactions, budgets, bills, goals, debts, templates, billPayments, profileRow] = await Promise.all([
    fetchAll('categories', userId),
    fetchAll('accounts', userId),
    fetchAll('transactions', userId),
    fetchAll('budgets', userId),
    fetchAll('bills', userId),
    fetchAll('goals', userId),
    fetchAll('debts', userId),
    fetchAll('templates', userId),
    fetchAll('bill_payments', userId),
    // `status` included so requireAuth can reject a suspended account on
    // every request, not just at login — a JWT issued before a suspension
    // doesn't reflect it. `two_factor_enabled`/`week_start` likewise so
    // requireAuth's 2FA step-up gate and budget-window computations don't
    // need a second profile fetch per request. `select('*')` rather than an
    // explicit column list deliberately — this runs on every single
    // authenticated request, so it must never hard-fail just because one of
    // the mobile Settings module's new columns (0019/0020_*.sql) hasn't been
    // manually applied yet; any column that doesn't exist is just absent
    // from the returned row, read defensively below via `profileRow?.x`.
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
      .then(({ data, error }) => { if (error) throw error; return data; }),
  ]);
  return {
    categories: rowsToCamel(categories, CATEGORY_FIELDS),
    accounts: rowsToCamel(accounts, ACCOUNT_FIELDS),
    transactions: rowsToCamel(transactions, TRANSACTION_FIELDS),
    budgets: rowsToCamel(budgets, BUDGET_FIELDS),
    bills: rowsToCamel(bills, BILL_FIELDS),
    goals: rowsToCamel(goals, GOAL_FIELDS),
    debts: rowsToCamel(debts, DEBT_FIELDS),
    templates: rowsToCamel(templates, TEMPLATE_FIELDS),
    billPayments: rowsToCamel(billPayments, BILL_PAYMENT_FIELDS),
    dashboardLayout: profileRow ? profileRow.dashboard_layout : null,
    plan: profileRow?.plan ?? 'free',
    status: profileRow?.status ?? 'active',
    twoFactorEnabled: !!profileRow?.two_factor_enabled,
    weekStart: profileRow?.week_start ?? 'system',
  };
}

// PostgREST reports a column that doesn't exist yet in one of two shapes
// depending on version: a raw Postgres `42703` (undefined_column) error, or
// its own schema-cache miss (`PGRST204`, "Could not find the 'x' column of
// 'table' in the schema cache"). Recognized here so a not-yet-applied
// migration (e.g. 0021_categories_type_sort_order.sql, still pending a
// manual apply — see that file's own comment) degrades to "the new field is
// silently dropped" instead of a hard 500 that blocks the entire insert/
// update, on every entity, not just categories.
function isMissingColumnError(error) {
  return error?.code === '42703' || error?.code === 'PGRST204';
}
// Same idea, for a whole table that doesn't exist yet (e.g. 0022_sessions.sql
// / 0023_two_factor_codes.sql before they've been manually applied) — raw
// Postgres `42P01` (undefined_table) or PostgREST's own `PGRST205` schema-
// cache miss. Used by requireAuth's per-request session lookup and the
// login-events session upsert, both of which must degrade to "session
// tracking unavailable" rather than 500 on literally every request.
function isMissingTableError(error) {
  return error?.code === '42P01' || error?.code === 'PGRST205';
}
// Strips whichever of `row`'s own keys the error message actually names, so
// a genuinely-unrelated column error on a field this row didn't even touch
// never gets silently swallowed — only ever narrows the payload, never
// changes which row/id is targeted.
function stripUnknownColumns(row, error) {
  const message = error?.message || '';
  const next = { ...row };
  let removedAny = false;
  for (const key of Object.keys(row)) {
    if (key !== 'user_id' && message.includes(key)) {
      delete next[key];
      removedAny = true;
    }
  }
  return removedAny ? next : null;
}

// Generic per-table insert/update/delete, all scoped to user_id so a caller
// can never touch another user's row even if a route forgot to check first.
function makeEntityHelpers(table, fields) {
  return {
    async insert(userId, data) {
      const row = camelToSnakePatch(data, fields);
      row.user_id = userId;
      let { data: created, error } = await supabase.from(table).insert(row).select().single();
      if (error && isMissingColumnError(error)) {
        const retryRow = stripUnknownColumns(row, error);
        if (retryRow) ({ data: created, error } = await supabase.from(table).insert(retryRow).select().single());
      }
      if (error) throw error;
      return rowToCamel(created, fields);
    },
    async update(userId, id, patch) {
      const row = camelToSnakePatch(patch, fields);
      let { data: updated, error } = await supabase.from(table).update(row).eq('id', id).eq('user_id', userId).select().maybeSingle();
      if (error && isMissingColumnError(error)) {
        const retryRow = stripUnknownColumns(row, error);
        if (retryRow) ({ data: updated, error } = await supabase.from(table).update(retryRow).eq('id', id).eq('user_id', userId).select().maybeSingle());
      }
      if (error) throw error;
      return updated ? rowToCamel(updated, fields) : null;
    },
    async remove(userId, id) {
      const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', userId);
      if (error) throw error;
    },
  };
}

const categoryHelpers = makeEntityHelpers('categories', CATEGORY_FIELDS);
const accountHelpers = makeEntityHelpers('accounts', ACCOUNT_FIELDS);

// Clears is_primary on every one of the user's accounts except `keepId` (or
// all of them, if omitted) — the app-side half of the "exactly one primary
// account" invariant, called right before a caller marks a different account
// primary so no two rows are ever true at once (see 0024_accounts_primary.sql
// for the DB-level partial-unique backstop). Degrades to a no-op if the
// column isn't migrated yet, same convention as isMissingColumnError elsewhere.
async function unsetOtherPrimaryAccounts(userId, keepId) {
  let q = supabase.from('accounts').update({ is_primary: false }).eq('user_id', userId).eq('is_primary', true);
  if (keepId) q = q.neq('id', keepId);
  const { error } = await q;
  if (error && !isMissingColumnError(error)) throw error;
}
const transactionHelpers = makeEntityHelpers('transactions', TRANSACTION_FIELDS);
const budgetHelpers = makeEntityHelpers('budgets', BUDGET_FIELDS);
const billHelpers = makeEntityHelpers('bills', BILL_FIELDS);
const goalHelpers = makeEntityHelpers('goals', GOAL_FIELDS);
const debtHelpers = makeEntityHelpers('debts', DEBT_FIELDS);
const templateHelpers = makeEntityHelpers('templates', TEMPLATE_FIELDS);
const conversationHelpers = makeEntityHelpers('ai_conversations', CONVERSATION_FIELDS);

async function insertBillPayment(userId, data) {
  const row = camelToSnakePatch(data, BILL_PAYMENT_FIELDS);
  row.user_id = userId;
  const { data: created, error } = await supabase.from('bill_payments').insert(row).select().single();
  if (error) throw error;
  return rowToCamel(created, BILL_PAYMENT_FIELDS);
}

async function insertTransactionsBulk(userId, rows) {
  const payload = rows.map((data) => {
    const row = camelToSnakePatch(data, TRANSACTION_FIELDS);
    row.user_id = userId;
    return row;
  });
  const { data, error } = await supabase.from('transactions').insert(payload).select();
  if (error) throw error;
  return rowsToCamel(data, TRANSACTION_FIELDS);
}

// Re-reads just the bills table straight from the DB, bypassing whatever a
// given request's own getUserBundle() snapshot already has cached in memory
// — used by server.js's per-user auto-post lock to re-validate a bill's
// due_date right before posting, since two concurrent requests' snapshots
// can otherwise both look "due" even after one of them has already advanced
// the real row.
async function getBills(userId) {
  const bills = await fetchAll('bills', userId);
  return rowsToCamel(bills, BILL_FIELDS);
}

async function getProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return rowToCamel(data, PROFILE_FIELDS);
}
async function updateProfile(userId, patch) {
  const row = camelToSnakePatch(patch, PROFILE_FIELDS);
  // Upsert, not update: the signup trigger normally guarantees a profiles
  // row exists, but if one's ever missing (row deleted by hand, or any other
  // gap), a plain UPDATE silently touches zero rows and returns null with no
  // error — every caller of updateProfile would then wrongly believe the
  // write succeeded. Upserting makes this self-healing instead.
  let { data, error } = await supabase.from('profiles').upsert({ id: userId, ...row }).select().maybeSingle();
  // Same not-yet-migrated-column degradation as makeEntityHelpers (see
  // isMissingColumnError) — e.g. 0019/0020's new profile columns before
  // they've been manually applied. Retries with just the unknown fields
  // dropped rather than failing every profile field in the same PATCH.
  if (error && isMissingColumnError(error)) {
    const retryRow = stripUnknownColumns({ id: userId, ...row }, error);
    if (retryRow) ({ data, error } = await supabase.from('profiles').upsert(retryRow).select().maybeSingle());
  }
  if (error) throw error;
  return rowToCamel(data, PROFILE_FIELDS);
}

// ---------------------------------------------------------------------------
// notification overlay — sparse read/dismissed state for the generated
// notification rows computeGeneratedRows() derives live from bills/budgets/
// goals/transactions on every request. Returned in the same shape the old
// in-memory userData.notifications array used ({ id, read, dismissed }), so
// computeGeneratedRows/generateNotificationsFor in server.js can stay
// byte-for-byte unchanged — callers just assign the result onto
// userData.notifications before invoking them.
// ---------------------------------------------------------------------------
async function getNotificationOverlay(userId) {
  const { data, error } = await supabase.from('notification_overlay').select('id, read, dismissed').eq('user_id', userId);
  if (error) throw error;
  return data || [];
}
async function upsertNotificationOverlay(userId, id, patch) {
  const row = { user_id: userId, id, updated_at: new Date().toISOString() };
  if (patch.read !== undefined) row.read = !!patch.read;
  if (patch.dismissed !== undefined) row.dismissed = !!patch.dismissed;
  const { error } = await supabase.from('notification_overlay').upsert(row, { onConflict: 'user_id,id' });
  if (error) throw error;
}
async function markAllNotificationsRead(userId, ids) {
  if (!ids || !ids.length) return;
  const rows = ids.map((id) => ({ user_id: userId, id, read: true, updated_at: new Date().toISOString() }));
  const { error } = await supabase.from('notification_overlay').upsert(rows, { onConflict: 'user_id,id' });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// AI usage counter — backs the aiRequestsPerDay plan limit (see plans.js).
// ---------------------------------------------------------------------------
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
async function getAiUsageToday(userId) {
  const { data, error } = await supabase.from('ai_usage').select('count').eq('user_id', userId).eq('day', todayStr()).maybeSingle();
  if (error) throw error;
  return data ? data.count : 0;
}
async function incrementAiUsage(userId) {
  const current = await getAiUsageToday(userId);
  const next = current + 1;
  const { error } = await supabase.from('ai_usage').upsert(
    { user_id: userId, day: todayStr(), count: next, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,day' }
  );
  if (error) throw error;
  return next;
}

// ---------------------------------------------------------------------------
// Ask AI conversations/messages — see 0018_ai_conversations.sql. Conversation
// list has no pagination (matches every other list endpoint in this codebase
// — a user's conversation count is small); messages use a real before/limit
// cursor since a single conversation can accumulate hundreds of rows.
// ---------------------------------------------------------------------------
async function listConversations(userId, { search } = {}) {
  let q = supabase.from('ai_conversations').select('*').eq('user_id', userId).order('last_message_at', { ascending: false });
  if (search) q = q.ilike('title', `%${search}%`);
  const { data, error } = await q;
  if (error) throw error;
  return rowsToCamel(data, CONVERSATION_FIELDS);
}
async function getConversation(userId, id) {
  const { data, error } = await supabase.from('ai_conversations').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data ? rowToCamel(data, CONVERSATION_FIELDS) : null;
}
// Oldest-first (reversed after the descending/limited fetch) so callers can
// render straight into a message list without re-sorting.
async function listMessages(userId, conversationId, { before, limit = 50 } = {}) {
  let q = supabase.from('ai_messages').select('*').eq('user_id', userId).eq('conversation_id', conversationId)
    .order('created_at', { ascending: false }).limit(limit);
  if (before) q = q.lt('created_at', before);
  const { data, error } = await q;
  if (error) throw error;
  return rowsToCamel(data, MESSAGE_FIELDS).reverse();
}
async function insertMessage(userId, conversationId, { role, content, metadata }) {
  const row = { user_id: userId, conversation_id: conversationId, role, content, metadata: metadata ?? null };
  const { data, error } = await supabase.from('ai_messages').insert(row).select().single();
  if (error) throw error;
  return rowToCamel(data, MESSAGE_FIELDS);
}
// Bumps last_message_at/updated_at on every send; also applied as the
// auto-title the first time a conversation gets a real message (title is
// still the 'New conversation' default up to that point).
async function touchConversation(userId, conversationId, { title } = {}) {
  const patch = { updated_at: new Date().toISOString(), last_message_at: new Date().toISOString() };
  if (title !== undefined) patch.title = title;
  const { data, error } = await supabase.from('ai_conversations').update(patch).eq('id', conversationId).eq('user_id', userId).select().maybeSingle();
  if (error) throw error;
  return data ? rowToCamel(data, CONVERSATION_FIELDS) : null;
}

// ---------------------------------------------------------------------------
// sessions — per-device list/revoke (mobile Settings > Security > Sessions).
// upsertSession is called on every login and (best-effort) periodically, so
// last_seen_at stays fresh without a separate heartbeat endpoint.
// ---------------------------------------------------------------------------
async function upsertSession(userId, { sessionId, platform, deviceLabel, appVersion, ip }) {
  const row = {
    user_id: userId, session_id: sessionId, platform: platform || null, device_label: deviceLabel || null,
    app_version: appVersion || null, ip: ip || null, last_seen_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('sessions').upsert(row, { onConflict: 'user_id,session_id' }).select().single();
  if (error) throw error;
  return rowToCamel(data, SESSION_FIELDS);
}
async function listSessions(userId) {
  const { data, error } = await supabase.from('sessions').select('*').eq('user_id', userId)
    .is('revoked_at', null).order('last_seen_at', { ascending: false });
  if (error) throw error;
  return rowsToCamel(data, SESSION_FIELDS);
}
async function getSessionBySessionId(userId, sessionId) {
  const { data, error } = await supabase.from('sessions').select('*').eq('user_id', userId).eq('session_id', sessionId).maybeSingle();
  if (error) throw error;
  return data ? rowToCamel(data, SESSION_FIELDS) : null;
}
async function revokeSession(userId, id) {
  const { error } = await supabase.from('sessions').update({ revoked_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId);
  if (error) throw error;
}
async function markSessionTwoFactorVerified(userId, sessionId) {
  const { error } = await supabase.from('sessions').update({ two_factor_verified_at: new Date().toISOString() })
    .eq('user_id', userId).eq('session_id', sessionId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// two-factor email-OTP codes (see 0023_two_factor_codes.sql). code_hash is
// the only thing ever stored — callers hash before calling insert, and
// compare hashes on verify, mirroring lib/security/pin.ts's approach.
// ---------------------------------------------------------------------------
async function insertTwoFactorCode(userId, { codeHash, purpose, expiresAt }) {
  const row = { user_id: userId, code_hash: codeHash, purpose, expires_at: expiresAt };
  const { data, error } = await supabase.from('two_factor_codes').insert(row).select().single();
  if (error) throw error;
  return rowToCamel(data, TWO_FACTOR_CODE_FIELDS);
}
// Most recent unconsumed, unexpired code for this user/purpose — codes are
// single-use and short-lived, so there's normally at most one live at a time.
async function getActiveTwoFactorCode(userId, purpose) {
  const { data, error } = await supabase.from('two_factor_codes').select('*').eq('user_id', userId).eq('purpose', purpose)
    .is('consumed_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data ? { ...rowToCamel(data, TWO_FACTOR_CODE_FIELDS), codeHash: data.code_hash } : null;
}
// Plain read-modify-write, not a DB-level increment — fine given how rarely
// a single code is verified concurrently (one user, one device, one code).
async function incrementTwoFactorAttempts(id) {
  const { data } = await supabase.from('two_factor_codes').select('attempts').eq('id', id).maybeSingle();
  const next = (data?.attempts || 0) + 1;
  await supabase.from('two_factor_codes').update({ attempts: next }).eq('id', id);
  return next;
}
async function consumeTwoFactorCode(id) {
  const { error } = await supabase.from('two_factor_codes').update({ consumed_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Reset Data — deletes every entity row for a user WITHOUT deleting the auth
// user/profile itself (distinct from DELETE /api/me, which deletes the whole
// account via supabase.auth.admin.deleteUser). Used by the irreversible
// "type RESET to confirm" flow, and as the required precondition before
// Cloud Backup's Restore (see POST /api/import — restore refuses to run
// against a non-empty account rather than attempting any merge/conflict
// resolution).
// ---------------------------------------------------------------------------
async function resetUserData(userId) {
  for (const table of RESETTABLE_TABLES) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId);
    if (error) throw error;
  }
}
async function countUserData(userId) {
  const counts = await Promise.all(
    RESETTABLE_TABLES.map((table) => supabase.from(table).select('id', { count: 'exact', head: true }).eq('user_id', userId))
  );
  return counts.reduce((sum, { count, error }) => {
    if (error) throw error;
    return sum + (count || 0);
  }, 0);
}

// Free-tier storage safeguard (Supabase's free plan caps total database
// storage at 500MB) — Ask AI history backs quick financial Q&A, not a
// durable record the way transactions/budgets/bills are, so it doesn't need
// to be kept indefinitely. No cron/scheduled job exists in this codebase, so
// cleanup is opportunistic instead: called from the two routes a user
// actually hits while using the feature (GET /api/ai/conversations,
// POST .../messages) rather than running as a background process. A single
// indexed DELETE (ai_conversations_user_last_message_idx) that's usually a
// no-op is cheap enough to run on every call. Cascades to ai_messages via
// its FK (0018_ai_conversations.sql), so this is the only delete needed.
// Mirrored in the mobile app's AskHistoryScreen copy — keep both in sync if
// this number ever changes.
const AI_HISTORY_RETENTION_DAYS = 5;
async function deleteOldConversations(userId) {
  const cutoff = new Date(Date.now() - AI_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from('ai_conversations').delete().eq('user_id', userId).lt('last_message_at', cutoff);
  if (error) throw error;
}

module.exports = {
  isMissingTableError,
  getUserBundle,
  getBills,
  getProfile,
  updateProfile,
  getNotificationOverlay,
  upsertNotificationOverlay,
  markAllNotificationsRead,
  upsertSession,
  listSessions,
  getSessionBySessionId,
  revokeSession,
  markSessionTwoFactorVerified,
  insertTwoFactorCode,
  getActiveTwoFactorCode,
  incrementTwoFactorAttempts,
  consumeTwoFactorCode,
  resetUserData,
  countUserData,
  insertTransactionsBulk,
  insertBillPayment,
  getAiUsageToday,
  incrementAiUsage,
  listConversations,
  getConversation,
  listMessages,
  insertMessage,
  touchConversation,
  deleteOldConversations,
  AI_HISTORY_RETENTION_DAYS,
  insertCategory: categoryHelpers.insert, updateCategory: categoryHelpers.update, deleteCategory: categoryHelpers.remove,
  insertAccount: accountHelpers.insert, updateAccount: accountHelpers.update, deleteAccount: accountHelpers.remove,
  unsetOtherPrimaryAccounts,
  insertTransaction: transactionHelpers.insert, updateTransaction: transactionHelpers.update, deleteTransaction: transactionHelpers.remove,
  insertBudget: budgetHelpers.insert, updateBudget: budgetHelpers.update, deleteBudget: budgetHelpers.remove,
  insertBill: billHelpers.insert, updateBill: billHelpers.update, deleteBill: billHelpers.remove,
  insertGoal: goalHelpers.insert, updateGoal: goalHelpers.update, deleteGoal: goalHelpers.remove,
  insertDebt: debtHelpers.insert, updateDebt: debtHelpers.update, deleteDebt: debtHelpers.remove,
  insertTemplate: templateHelpers.insert, updateTemplate: templateHelpers.update, deleteTemplate: templateHelpers.remove,
  insertConversation: conversationHelpers.insert, updateConversation: conversationHelpers.update, deleteConversation: conversationHelpers.remove,
  // Exported so adminDb.js's cross-user listUsers() can map `profiles` rows
  // with the exact same field convention instead of duplicating it.
  PROFILE_FIELDS,
};
