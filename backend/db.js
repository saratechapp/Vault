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
];
const ACCOUNT_FIELDS = [
  ['id', 'id'], ['name', 'name'], ['type', 'type'], ['opening_balance', 'openingBalance'],
  ['color', 'color'], ['icon', 'icon'], ['currency', 'currency'], ['institution', 'institution'],
  ['credit_limit', 'creditLimit'],
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
  ['note', 'note'], ['labels', 'labels'], ['auto_post', 'autoPost'], ['autopay', 'autopay'], ['active', 'active'], ['last_run', 'lastRun'],
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
];
// Payment-time log backing BillAnalysisService's payment-history/late-payment
// insights (see 0007_bill_payments.sql) — write-once per payment, read via
// getUserBundle like every other entity.
const BILL_PAYMENT_FIELDS = [
  ['id', 'id'], ['bill_id', 'billId'], ['transaction_id', 'transactionId'],
  ['due_date_at_payment', 'dueDateAtPayment'], ['paid_date', 'paidDate'], ['was_late', 'wasLate'],
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
    // doesn't reflect it.
    supabase.from('profiles').select('dashboard_layout, plan, status, sessions_invalidated_at').eq('id', userId).maybeSingle()
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
    plan: profileRow ? profileRow.plan : 'free',
    status: profileRow ? profileRow.status : 'active',
  };
}

// Generic per-table insert/update/delete, all scoped to user_id so a caller
// can never touch another user's row even if a route forgot to check first.
function makeEntityHelpers(table, fields) {
  return {
    async insert(userId, data) {
      const row = camelToSnakePatch(data, fields);
      row.user_id = userId;
      const { data: created, error } = await supabase.from(table).insert(row).select().single();
      if (error) throw error;
      return rowToCamel(created, fields);
    },
    async update(userId, id, patch) {
      const row = camelToSnakePatch(patch, fields);
      const { data: updated, error } = await supabase.from(table).update(row).eq('id', id).eq('user_id', userId).select().maybeSingle();
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
const transactionHelpers = makeEntityHelpers('transactions', TRANSACTION_FIELDS);
const budgetHelpers = makeEntityHelpers('budgets', BUDGET_FIELDS);
const billHelpers = makeEntityHelpers('bills', BILL_FIELDS);
const goalHelpers = makeEntityHelpers('goals', GOAL_FIELDS);
const debtHelpers = makeEntityHelpers('debts', DEBT_FIELDS);
const templateHelpers = makeEntityHelpers('templates', TEMPLATE_FIELDS);

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
  const { data, error } = await supabase.from('profiles').upsert({ id: userId, ...row }).select().maybeSingle();
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

module.exports = {
  getUserBundle,
  getProfile,
  updateProfile,
  getNotificationOverlay,
  upsertNotificationOverlay,
  markAllNotificationsRead,
  insertTransactionsBulk,
  insertBillPayment,
  getAiUsageToday,
  incrementAiUsage,
  insertCategory: categoryHelpers.insert, updateCategory: categoryHelpers.update, deleteCategory: categoryHelpers.remove,
  insertAccount: accountHelpers.insert, updateAccount: accountHelpers.update, deleteAccount: accountHelpers.remove,
  insertTransaction: transactionHelpers.insert, updateTransaction: transactionHelpers.update, deleteTransaction: transactionHelpers.remove,
  insertBudget: budgetHelpers.insert, updateBudget: budgetHelpers.update, deleteBudget: budgetHelpers.remove,
  insertBill: billHelpers.insert, updateBill: billHelpers.update, deleteBill: billHelpers.remove,
  insertGoal: goalHelpers.insert, updateGoal: goalHelpers.update, deleteGoal: goalHelpers.remove,
  insertDebt: debtHelpers.insert, updateDebt: debtHelpers.update, deleteDebt: debtHelpers.remove,
  insertTemplate: templateHelpers.insert, updateTemplate: templateHelpers.update, deleteTemplate: templateHelpers.remove,
  // Exported so adminDb.js's cross-user listUsers() can map `profiles` rows
  // with the exact same field convention instead of duplicating it.
  PROFILE_FIELDS,
};
