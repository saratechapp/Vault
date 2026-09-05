const { supabase } = require('./supabaseClient');
const { rowToCamel, rowsToCamel, camelToSnakePatch } = require('./lib/supabaseMapper');
const subscriptionService = require('./services/subscriptionService');
const currencyService = require('./services/currencyService');

// ---------------------------------------------------------------------------
// field maps: [snake_case column, camelCase field] pairs per table. Shared by
// the row->camelCase mapper (reads) and the camelCase->snake_case patch
// builder (writes), so every insert/update/select stays byte-identical to
// the field names server.js already expects (cross-referenced against every
// read/write site in server.js, not guessed).
// ---------------------------------------------------------------------------
// `updated_at` (added by 0030_sync_metadata.sql, auto-touched by trigger) is
// read-only: it's in these maps so GET responses and /api/changes expose it,
// but the write helpers never emit it (route patch builders don't carry it,
// and upsert() strips it) so the trigger stays authoritative.
const CATEGORY_FIELDS = [
  ['id', 'id'], ['name', 'name'], ['icon', 'icon'], ['color', 'color'], ['parent_id', 'parentId'],
  ['type', 'type'], ['sort_order', 'sortOrder'], ['updated_at', 'updatedAt'],
];
const ACCOUNT_FIELDS = [
  ['id', 'id'], ['name', 'name'], ['type', 'type'], ['opening_balance', 'openingBalance'],
  ['color', 'color'], ['icon', 'icon'], ['currency', 'currency'], ['institution', 'institution'],
  ['credit_limit', 'creditLimit'], ['is_primary', 'isPrimary'], ['updated_at', 'updatedAt'],
];
const TRANSACTION_FIELDS = [
  ['id', 'id'], ['date', 'date'], ['vendor', 'vendor'], ['category_id', 'categoryId'], ['amount', 'amount'], ['type', 'type'],
  ['payment_method', 'paymentMethod'], ['note', 'note'], ['labels', 'labels'], ['payer', 'payer'], ['payment_status', 'paymentStatus'],
  ['currency', 'currency'], ['account_id', 'accountId'], ['from_account_id', 'fromAccountId'], ['to_account_id', 'toAccountId'],
  ['source_bill_id', 'sourceBillId'], ['source_debt_id', 'sourceDebtId'], ['goal_id', 'goalId'], ['updated_at', 'updatedAt'],
];
const BUDGET_FIELDS = [
  ['id', 'id'], ['category_id', 'categoryId'], ['limit', 'limit'], ['period', 'period'],
  ['alert_at', 'alertAt'], ['start_date', 'startDate'], ['end_date', 'endDate'], ['updated_at', 'updatedAt'],
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
  ['updated_at', 'updatedAt'],
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
  // Subscription / free-trial (0025_subscriptions.sql). `subscription_type`
  // is the stored intent; the live status is derived from these dates by
  // services/subscriptionService.js.
  ['subscription_type', 'subscriptionType'], ['trial_started_at', 'trialStartedAt'],
  ['trial_ends_at', 'trialEndsAt'], ['subscription_started_at', 'subscriptionStartedAt'],
  ['subscription_ends_at', 'subscriptionEndsAt'], ['subscription_updated_at', 'subscriptionUpdatedAt'],
  // Subscription pricing (0026_subscription_pricing.sql). `billingCurrency` is
  // the user's chosen subscription-display currency, deliberately separate
  // from `currency` (app-wide money formatting). The last three are the
  // price-at-purchase record a future payment flow will write.
  ['billing_currency', 'billingCurrency'], ['subscription_currency', 'subscriptionCurrency'],
  ['subscription_price_at_purchase', 'subscriptionPriceAtPurchase'],
  ['subscription_billing_period', 'subscriptionBillingPeriod'],
  // Recurring-billing mirror (0029_subscription_billing.sql) — written only by
  // the webhook handler (services/subscriptionBillingService.js) so the 0025
  // read paths above keep working unchanged.
  ['subscription_provider', 'subscriptionProvider'],
  ['subscription_provider_customer_id', 'subscriptionProviderCustomerId'],
  ['subscription_provider_subscription_id', 'subscriptionProviderSubscriptionId'],
  ['subscription_current_period_start', 'subscriptionCurrentPeriodStart'],
  ['subscription_current_period_end', 'subscriptionCurrentPeriodEnd'],
  ['subscription_cancel_at_period_end', 'subscriptionCancelAtPeriodEnd'],
];

const SUBSCRIPTION_SETTINGS_FIELDS = [
  ['trial_enabled', 'trialEnabled'], ['trial_duration_months', 'trialDurationMonths'],
  ['enforcement_started_at', 'enforcementStartedAt'],
  ['enforcement_enabled', 'enforcementEnabled'], ['default_currency', 'defaultCurrency'],
  ['updated_at', 'updatedAt'], ['updated_by', 'updatedBy'],
];

const SUBSCRIPTION_SETTINGS_DEFAULTS = Object.freeze({
  trialEnabled: false,
  trialDurationMonths: 1,
  enforcementStartedAt: null,
  enforcementEnabled: false,
  defaultCurrency: 'INR',
  updatedAt: null,
  updatedBy: null,
});

const SUBSCRIPTION_PRICE_FIELDS = [
  ['currency', 'currency'], ['monthly_price', 'monthlyPrice'], ['yearly_price', 'yearlyPrice'],
  ['enabled', 'enabled'], ['updated_at', 'updatedAt'], ['updated_by', 'updatedBy'],
  // Provider plan/price ids per currency + cycle (0029_subscription_billing.sql).
  // Null until a Super Admin fills them in; nothing hardcodes a plan id.
  ['stripe_price_monthly', 'stripePriceMonthly'], ['stripe_price_yearly', 'stripePriceYearly'],
  ['razorpay_plan_monthly', 'razorpayPlanMonthly'], ['razorpay_plan_yearly', 'razorpayPlanYearly'],
];
// Which SUBSCRIPTION_PRICE_FIELDS columns arrived with 0029 — dropped from an
// upsert and retried if the DB doesn't have them yet (0029 unapplied), the
// same degradation updateSubscriptionSettings does for 0026's columns.
const SUBSCRIPTION_PRICE_PROVIDER_COLUMNS = [
  'stripe_price_monthly', 'stripe_price_yearly', 'razorpay_plan_monthly', 'razorpay_plan_yearly',
];

// Recurring billing (0029_subscription_billing.sql). `subscriptions` is the
// provider-linked source of truth; the webhook handler is its only writer.
const SUBSCRIPTION_FIELDS = [
  ['id', 'id'], ['user_id', 'userId'], ['provider', 'provider'],
  ['provider_customer_id', 'providerCustomerId'], ['provider_subscription_id', 'providerSubscriptionId'],
  ['plan_id', 'planId'], ['plan_name', 'planName'], ['billing_cycle', 'billingCycle'],
  ['amount', 'amount'], ['currency', 'currency'], ['status', 'status'],
  ['trial_start_at', 'trialStartAt'], ['trial_end_at', 'trialEndAt'],
  ['current_period_start', 'currentPeriodStart'], ['current_period_end', 'currentPeriodEnd'],
  ['next_billing_date', 'nextBillingDate'], ['cancel_at_period_end', 'cancelAtPeriodEnd'],
  ['provider_status', 'providerStatus'], ['latest_invoice_id', 'latestInvoiceId'],
  ['created_at', 'createdAt'], ['updated_at', 'updatedAt'],
];
const SUBSCRIPTION_EVENT_FIELDS = [
  ['id', 'id'], ['provider', 'provider'], ['type', 'type'], ['canonical_type', 'canonicalType'],
  ['provider_subscription_id', 'providerSubscriptionId'], ['user_id', 'userId'],
  ['payload', 'payload'], ['error', 'error'],
  ['received_at', 'receivedAt'], ['processed_at', 'processedAt'],
];
// Live = a subscription that should currently grant (or is about to grant)
// access. Matches the partial unique index in 0029.
const LIVE_SUBSCRIPTION_STATUSES = ['incomplete', 'trialing', 'active', 'past_due', 'paused'];
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
// A Postgres function that hasn't been created yet — raw `42883`
// (undefined_function) or PostgREST's `PGRST202` schema-cache miss. Lets
// bumpReceiptScanCounter prefer the atomic increment_receipt_scan() RPC
// (0028) when it exists and fall back to the read-modify-write upsert when
// it doesn't, so the scanner keeps working before that migration is applied.
function isMissingFunctionError(error) {
  return error?.code === '42883' || error?.code === 'PGRST202';
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A permission-style error the route layer maps to 403 (see errorHandlers /
// the route handlers' try/catch). Thrown when a client-supplied id already
// belongs to a different user.
function forbiddenError(message) {
  const e = new Error(message || 'forbidden');
  e.status = 403;
  return e;
}

// Records that `entityType/entityId` was deleted for this user, so a mobile
// client that was offline at the time learns about it on its next
// GET /api/changes pull. Best-effort: degrades to a no-op until
// 0030_sync_metadata.sql is applied. `syncEntityType` is null for tables the
// mobile app doesn't mirror (bills/debts/templates/conversations in Phase 1).
async function writeTombstone(userId, syncEntityType, entityId) {
  if (!syncEntityType) return;
  try {
    const { error } = await supabase
      .from('sync_tombstones')
      .upsert(
        { user_id: userId, entity_type: syncEntityType, entity_id: entityId, deleted_at: new Date().toISOString() },
        { onConflict: 'user_id,entity_type,entity_id' }
      );
    if (error && !isMissingTableError(error)) throw error;
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
  }
}

// Generic per-table insert/update/delete, all scoped to user_id so a caller
// can never touch another user's row even if a route forgot to check first.
// `syncEntityType` (optional) opts the table into offline-sync support:
// tombstone-on-delete and the client-id-aware `upsert` path.
function makeEntityHelpers(table, fields, syncEntityType = null) {
  async function insert(userId, data) {
    const row = camelToSnakePatch(data, fields);
    row.user_id = userId;
    let { data: created, error } = await supabase.from(table).insert(row).select().single();
    if (error && isMissingColumnError(error)) {
      const retryRow = stripUnknownColumns(row, error);
      if (retryRow) ({ data: created, error } = await supabase.from(table).insert(retryRow).select().single());
    }
    if (error) throw error;
    return rowToCamel(created, fields);
  }

  async function update(userId, id, patch) {
    const row = camelToSnakePatch(patch, fields);
    let { data: updated, error } = await supabase.from(table).update(row).eq('id', id).eq('user_id', userId).select().maybeSingle();
    if (error && isMissingColumnError(error)) {
      const retryRow = stripUnknownColumns(row, error);
      if (retryRow) ({ data: updated, error } = await supabase.from(table).update(retryRow).eq('id', id).eq('user_id', userId).select().maybeSingle());
    }
    if (error) throw error;
    return updated ? rowToCamel(updated, fields) : null;
  }

  async function remove(userId, id) {
    const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', userId);
    if (error) throw error;
    await writeTombstone(userId, syncEntityType, id);
  }

  // Insert-or-replace keyed on a client-generated `data.id`. Used by the
  // POST routes so an offline-created row keeps the same primary key when it
  // finally syncs, and a retried sync (flaky network) is idempotent rather
  // than creating a duplicate. Falls back to a plain insert when no valid id
  // is supplied — i.e. every existing web-app caller is unaffected.
  async function upsert(userId, data) {
    const id = data && data.id;
    if (!id || !UUID_RE.test(String(id))) return insert(userId, data);

    const { data: existing, error: selErr } = await supabase
      .from(table)
      .select('user_id')
      .eq('id', id)
      .maybeSingle();
    if (selErr) throw selErr;
    if (existing && existing.user_id !== userId) throw forbiddenError('id belongs to another user');

    const row = camelToSnakePatch(data, fields);
    delete row.updated_at; // trigger-owned; never take the client's value
    row.id = id;
    row.user_id = userId;
    let { data: saved, error } = await supabase.from(table).upsert(row, { onConflict: 'id' }).select().single();
    if (error && isMissingColumnError(error)) {
      const retryRow = stripUnknownColumns(row, error);
      if (retryRow) {
        retryRow.id = id;
        ({ data: saved, error } = await supabase.from(table).upsert(retryRow, { onConflict: 'id' }).select().single());
      }
    }
    if (error) throw error;
    return rowToCamel(saved, fields);
  }

  return { insert, update, remove, upsert };
}

const categoryHelpers = makeEntityHelpers('categories', CATEGORY_FIELDS, 'category');
const accountHelpers = makeEntityHelpers('accounts', ACCOUNT_FIELDS, 'account');

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
const transactionHelpers = makeEntityHelpers('transactions', TRANSACTION_FIELDS, 'transaction');
const budgetHelpers = makeEntityHelpers('budgets', BUDGET_FIELDS, 'budget');
const billHelpers = makeEntityHelpers('bills', BILL_FIELDS);
const goalHelpers = makeEntityHelpers('goals', GOAL_FIELDS, 'goal');
const debtHelpers = makeEntityHelpers('debts', DEBT_FIELDS);
const templateHelpers = makeEntityHelpers('templates', TEMPLATE_FIELDS);
const conversationHelpers = makeEntityHelpers('ai_conversations', CONVERSATION_FIELDS);

// ---------------------------------------------------------------------------
// Offline-sync delta feed (GET /api/changes). Returns every mirrored row this
// user has touched since `sinceIso` plus the tombstones for anything deleted
// since then, so a reconnecting mobile client can catch up without re-pulling
// its whole dataset. Degrades safely before 0030_sync_metadata.sql is
// applied: no `updated_at` column -> return the full set; no tombstone table
// -> return an empty tombstone list.
// ---------------------------------------------------------------------------
const SYNC_ENTITY_TABLES = [
  ['transaction', 'transactions', TRANSACTION_FIELDS, 'transactions'],
  ['account', 'accounts', ACCOUNT_FIELDS, 'accounts'],
  ['category', 'categories', CATEGORY_FIELDS, 'categories'],
  ['budget', 'budgets', BUDGET_FIELDS, 'budgets'],
  ['goal', 'goals', GOAL_FIELDS, 'goals'],
];

async function getChangesSince(userId, sinceIso) {
  const upserts = {};
  for (const [, table, fields, pluralKey] of SYNC_ENTITY_TABLES) {
    let query = supabase.from(table).select('*').eq('user_id', userId);
    if (sinceIso) query = query.gt('updated_at', sinceIso);
    let { data, error } = await query;
    if (error && isMissingColumnError(error)) {
      // Pre-0030: no updated_at to filter on — hand back the whole table and
      // let the client reconcile by id.
      ({ data, error } = await supabase.from(table).select('*').eq('user_id', userId));
    }
    if (error) throw error;
    upserts[pluralKey] = rowsToCamel(data || [], fields);
  }

  let tombstones = [];
  try {
    let tq = supabase.from('sync_tombstones').select('*').eq('user_id', userId);
    if (sinceIso) tq = tq.gt('deleted_at', sinceIso);
    const { data, error } = await tq;
    if (error && !isMissingTableError(error)) throw error;
    tombstones = (data || []).map((r) => ({
      entityType: r.entity_type,
      entityId: r.entity_id,
      deletedAt: r.deleted_at,
    }));
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
  }

  return { cursor: new Date().toISOString(), upserts, tombstones };
}

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
// subscription / free-trial (0025_subscriptions.sql)
// ---------------------------------------------------------------------------

// Overlay only the keys the row actually provided — so a column added by a
// not-yet-applied migration (0026's enforcement_enabled / default_currency
// while only 0025 is live) reads back `undefined` from rowToCamel and must
// NOT clobber its default.
function withDefaults(defaults, mapped) {
  const out = { ...defaults };
  for (const [k, v] of Object.entries(mapped || {})) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

// The single global settings row. Degrades to safe "trial system off"
// defaults if the table isn't there yet (0025 not applied) — same tolerance
// as getSessionBySessionId for 0022.
async function getSubscriptionSettings() {
  try {
    const { data, error } = await supabase
      .from('subscription_settings').select('*').eq('id', true).maybeSingle();
    if (error) throw error;
    if (!data) return { ...SUBSCRIPTION_SETTINGS_DEFAULTS };
    return withDefaults(SUBSCRIPTION_SETTINGS_DEFAULTS, rowToCamel(data, SUBSCRIPTION_SETTINGS_FIELDS));
  } catch (err) {
    if (isMissingTableError(err)) return { ...SUBSCRIPTION_SETTINGS_DEFAULTS };
    throw err;
  }
}

// Super-Admin-only write (route enforces requireSuperAdmin). `enforcement
// _started_at` is stamped exactly once — the first time the trial system is
// switched on — because it's the grandfather cutoff every later resolution
// keys off; flipping the toggle off and on again must not move it.
async function updateSubscriptionSettings(patch, updatedBy) {
  const current = await getSubscriptionSettings();
  const next = {
    trialEnabled: patch.trialEnabled !== undefined ? !!patch.trialEnabled : current.trialEnabled,
    trialDurationMonths:
      patch.trialDurationMonths !== undefined
        ? Math.min(12, Math.max(1, Number(patch.trialDurationMonths) || 1))
        : current.trialDurationMonths,
    enforcementEnabled:
      patch.enforcementEnabled !== undefined ? !!patch.enforcementEnabled : current.enforcementEnabled,
    defaultCurrency:
      patch.defaultCurrency !== undefined
        ? String(patch.defaultCurrency).toUpperCase()
        : current.defaultCurrency,
  };
  // A default currency must have an enabled price row to fall back to.
  if (patch.defaultCurrency !== undefined) {
    const prices = await getSubscriptionPrices();
    const ok = prices.some((p) => p.enabled && p.currency === next.defaultCurrency);
    if (!ok) {
      const err = new Error('default_currency_not_priced');
      err.code = 'DEFAULT_CURRENCY_NOT_PRICED';
      throw err;
    }
  }
  let enforcementStartedAt = current.enforcementStartedAt;
  if (next.trialEnabled && !enforcementStartedAt) enforcementStartedAt = new Date().toISOString();

  const row = {
    id: true,
    trial_enabled: next.trialEnabled,
    trial_duration_months: next.trialDurationMonths,
    enforcement_started_at: enforcementStartedAt,
    enforcement_enabled: next.enforcementEnabled,
    default_currency: next.defaultCurrency,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy || null,
  };
  let { data, error } = await supabase
    .from('subscription_settings').upsert(row).select().maybeSingle();
  // 0026's columns (enforcement_enabled / default_currency, always added
  // together) not applied yet — drop both and retry so the pre-0026 trial
  // toggle still saves. Same spirit as updateProfile's degradation for
  // 0019/0020.
  if (error && isMissingColumnError(error)) {
    const { enforcement_enabled, default_currency, ...pre0026 } = row;
    ({ data, error } = await supabase.from('subscription_settings').upsert(pre0026).select().maybeSingle());
  }
  if (error) throw error;
  return withDefaults(SUBSCRIPTION_SETTINGS_DEFAULTS, rowToCamel(data, SUBSCRIPTION_SETTINGS_FIELDS));
}

// Resolve (and, on first touch, persist) a user's subscription record, then
// return the API shape. Self-healing: a profile whose subscription_type is
// still null gets its initial record written now, exactly like the
// has_password backfill. Never throws on a not-yet-applied 0025 — falls back
// to a computed FREE_ACCESS shape.
async function resolveForUser(userId, profileRow) {
  const now = new Date();
  const profile = profileRow || (await getProfile(userId));

  if (profile && profile.subscriptionType) {
    const cancelAtPeriodEnd = !!profile.subscriptionCancelAtPeriodEnd;
    const currentPeriodEnd = profile.subscriptionCurrentPeriodEnd || null;
    return subscriptionService.toApiShape(
      {
        type: profile.subscriptionType,
        trialStartedAt: profile.trialStartedAt,
        trialEndsAt: profile.trialEndsAt,
        subscriptionStartedAt: profile.subscriptionStartedAt,
        subscriptionEndsAt: profile.subscriptionEndsAt,
        // Recurring-billing mirror (0029) — null for anyone who never checked
        // out through a provider, so pre-billing behaviour is unchanged.
        provider: profile.subscriptionProvider,
        billingCycle: profile.subscriptionBillingPeriod,
        currentPeriodStart: profile.subscriptionCurrentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd,
        // A scheduled-to-cancel subscription has no next charge; otherwise the
        // period end is when the provider will next attempt payment.
        nextBillingDate: cancelAtPeriodEnd ? null : currentPeriodEnd,
      },
      now
    );
  }

  const settings = await getSubscriptionSettings();
  const initial = subscriptionService.resolveInitialSubscription({
    profileCreatedAt: profile?.memberSince || now,
    settings,
    now,
  });

  try {
    await updateProfile(userId, {
      subscriptionType: initial.type,
      trialStartedAt: initial.trialStartedAt ? initial.trialStartedAt.toISOString() : null,
      trialEndsAt: initial.trialEndsAt ? initial.trialEndsAt.toISOString() : null,
      subscriptionUpdatedAt: now.toISOString(),
    });
  } catch (err) {
    // 0025 not applied yet — return the computed shape without persisting
    // rather than 500ing every authenticated request.
    if (!isMissingColumnError(err) && !isMissingTableError(err)) throw err;
  }

  return subscriptionService.toApiShape(initial, now);
}

// ---------------------------------------------------------------------------
// subscription pricing (0026_subscription_pricing.sql) — admin-configured
// per-currency prices; NO FX conversion anywhere.
// ---------------------------------------------------------------------------
// Thrown by the pricing writers when 0026_subscription_pricing.sql hasn't
// been applied — the admin routes turn this into a clear 409 instead of a
// raw 500. Reads (getSubscriptionPrices) just degrade to [].
function pricingNotMigratedError() {
  const err = new Error('subscription_prices table not found — apply 0026_subscription_pricing.sql');
  err.code = 'PRICING_NOT_MIGRATED';
  return err;
}

async function subscriptionPricingMigrated() {
  const { error } = await supabase.from('subscription_prices').select('currency', { head: true, count: 'exact' });
  if (!error) return true;
  if (isMissingTableError(error)) return false;
  throw error;
}

async function getSubscriptionPrices() {
  try {
    const { data, error } = await supabase
      .from('subscription_prices').select('*').order('currency', { ascending: true });
    if (error) throw error;
    return rowsToCamel(data || [], SUBSCRIPTION_PRICE_FIELDS).map((r) => ({
      ...r,
      monthlyPrice: Number(r.monthlyPrice) || 0,
      yearlyPrice: Number(r.yearlyPrice) || 0,
    }));
  } catch (err) {
    if (isMissingTableError(err)) return [];
    throw err;
  }
}

async function upsertSubscriptionPrice(
  currency,
  { monthlyPrice, yearlyPrice, enabled, stripePriceMonthly, stripePriceYearly, razorpayPlanMonthly, razorpayPlanYearly },
  updatedBy
) {
  const row = {
    currency: String(currency).toUpperCase(),
    monthly_price: Math.max(0, Number(monthlyPrice) || 0),
    yearly_price: Math.max(0, Number(yearlyPrice) || 0),
    enabled: enabled === undefined ? true : !!enabled,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy || null,
  };
  // Only touch a provider-plan column when the caller actually passed it, so a
  // price edit that doesn't mention plan ids never nulls existing ones. `null`
  // is a deliberate "clear it"; `undefined` is "leave alone".
  const nz = (v) => (v === undefined ? undefined : v === null || v === '' ? null : String(v).trim());
  if (stripePriceMonthly !== undefined) row.stripe_price_monthly = nz(stripePriceMonthly);
  if (stripePriceYearly !== undefined) row.stripe_price_yearly = nz(stripePriceYearly);
  if (razorpayPlanMonthly !== undefined) row.razorpay_plan_monthly = nz(razorpayPlanMonthly);
  if (razorpayPlanYearly !== undefined) row.razorpay_plan_yearly = nz(razorpayPlanYearly);

  let { data, error } = await supabase
    .from('subscription_prices').upsert(row, { onConflict: 'currency' }).select().maybeSingle();
  // 0029's provider-plan columns not applied yet — drop them and retry so the
  // pre-0029 price edit still saves (same spirit as updateSubscriptionSettings
  // for 0026's columns).
  if (error && isMissingColumnError(error)) {
    for (const col of SUBSCRIPTION_PRICE_PROVIDER_COLUMNS) delete row[col];
    ({ data, error } = await supabase
      .from('subscription_prices').upsert(row, { onConflict: 'currency' }).select().maybeSingle());
  }
  if (error) {
    if (isMissingTableError(error)) throw pricingNotMigratedError();
    throw error;
  }
  const mapped = rowToCamel(data, SUBSCRIPTION_PRICE_FIELDS);
  return { ...mapped, monthlyPrice: Number(mapped.monthlyPrice) || 0, yearlyPrice: Number(mapped.yearlyPrice) || 0 };
}

async function deleteSubscriptionPrice(currency) {
  const { error } = await supabase
    .from('subscription_prices').delete().eq('currency', String(currency).toUpperCase());
  if (error) {
    if (isMissingTableError(error)) throw pricingNotMigratedError();
    throw error;
  }
}

// The `pricing` block returned on GET /api/subscription and PATCH
// /api/subscription/currency. Pure assembly on top of the config reads + the
// currencyService resolver; no per-user DB write. `settings` may be passed in
// to avoid a duplicate single-row read when the caller already has it.
async function resolvePricingForUser(profile, { localeHint, ipCountry, settings } = {}) {
  const [prices, resolvedSettings] = await Promise.all([
    getSubscriptionPrices(),
    settings ? Promise.resolve(settings) : getSubscriptionSettings(),
  ]);
  const enabledRows = prices.filter((p) => p.enabled);
  const enabledCurrencies = enabledRows.map((p) => p.currency);
  const defaultCurrency = enabledCurrencies.includes(resolvedSettings.defaultCurrency)
    ? resolvedSettings.defaultCurrency
    : (enabledCurrencies[0] || 'INR');

  const { currency, source } = currencyService.resolveCurrency({
    billingCurrency: profile?.billingCurrency,
    profileCurrency: profile?.currency,
    profileCountry: profile?.country,
    ipCountry,
    localeHint,
    enabledCurrencies,
    defaultCurrency,
  });

  const shapeRow = (p) => {
    const yEq = currencyService.yearlyEquivalentMonthly(p.yearlyPrice);
    return {
      code: p.currency,
      symbol: currencyService.currencyMeta(p.currency).symbol,
      name: currencyService.currencyMeta(p.currency).name,
      locale: currencyService.currencyMeta(p.currency).locale,
      monthly: p.monthlyPrice,
      yearly: p.yearlyPrice,
      monthlyFormatted: currencyService.formatMoney(p.monthlyPrice, p.currency),
      yearlyFormatted: currencyService.formatMoney(p.yearlyPrice, p.currency),
      yearlySavingsPct: currencyService.yearlySavingsPct(p.monthlyPrice, p.yearlyPrice),
      yearlyEquivalentMonthly: yEq,
      yearlyEquivalentMonthlyFormatted: currencyService.formatMoney(yEq, p.currency),
    };
  };

  const currencies = enabledRows.map(shapeRow);
  const selected = currencies.find((c) => c.code === currency) || currencies[0] || null;

  return {
    currency: selected?.code || currency,
    source,
    defaultCurrency,
    configured: enabledRows.length > 0,
    currencies,
    selected,
  };
}

// ---------------------------------------------------------------------------
// recurring billing (0029_subscription_billing.sql) — the `subscriptions` and
// `subscription_events` tables. The webhook handler
// (services/subscriptionBillingService.js) is the ONLY writer of subscription
// state; consumer routes only ever read, or ask a provider adapter to act and
// wait for the confirming webhook. Every read degrades to "no billing" if
// 0029 hasn't been applied, exactly like getSubscriptionSettings for 0025.
// ---------------------------------------------------------------------------

async function subscriptionBillingMigrated() {
  const { error } = await supabase.from('subscriptions').select('id', { head: true, count: 'exact' });
  if (!error) return true;
  if (isMissingTableError(error)) return false;
  throw error;
}

// The user's current live subscription row (the one the partial unique index
// guarantees is unique), or null.
async function getLiveSubscriptionForUser(userId) {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .in('status', LIVE_SUBSCRIPTION_STATUSES)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToCamel(data, SUBSCRIPTION_FIELDS) : null;
  } catch (err) {
    if (isMissingTableError(err)) return null;
    throw err;
  }
}

async function getSubscriptionByProviderId(providerSubscriptionId) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('provider_subscription_id', providerSubscriptionId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToCamel(data, SUBSCRIPTION_FIELDS) : null;
}

async function listSubscriptionsForUser(userId) {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return rowsToCamel(data || [], SUBSCRIPTION_FIELDS);
  } catch (err) {
    if (isMissingTableError(err)) return [];
    throw err;
  }
}

// Insert (checkout) or update (webhook) a subscription row. `patch` is
// camelCase per SUBSCRIPTION_FIELDS. On insert, `userId` + `provider` are
// required; on update, `id` selects the row.
async function upsertSubscriptionRecord(patch) {
  const row = camelToSnakePatch(patch, SUBSCRIPTION_FIELDS);
  row.updated_at = new Date().toISOString();
  if (patch.id) {
    const { data, error } = await supabase
      .from('subscriptions').update(row).eq('id', patch.id).select().maybeSingle();
    if (error) throw error;
    return data ? rowToCamel(data, SUBSCRIPTION_FIELDS) : null;
  }
  if (patch.userId) row.user_id = patch.userId;
  // Prefer an idempotent upsert keyed on the provider's own subscription id so
  // a webhook that arrives before the checkout row is written still lands one
  // row, not two.
  const onConflict = patch.providerSubscriptionId ? 'provider_subscription_id' : undefined;
  const q = supabase.from('subscriptions').upsert(row, onConflict ? { onConflict } : undefined).select().maybeSingle();
  const { data, error } = await q;
  if (error) throw error;
  return data ? rowToCamel(data, SUBSCRIPTION_FIELDS) : null;
}

// Idempotent: returns { created, event }. `created` is false when this
// provider event id was already recorded (a replay) — the caller then skips
// re-processing.
async function recordSubscriptionEvent(evt) {
  const row = {
    id: evt.id,
    provider: evt.provider,
    type: evt.type || null,
    canonical_type: evt.canonicalType || null,
    provider_subscription_id: evt.providerSubscriptionId || null,
    user_id: evt.userId || null,
    payload: evt.payload ?? null,
    received_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('subscription_events')
    .insert(row)
    .select()
    .maybeSingle();
  if (error) {
    // Unique-violation on the primary key => we've already seen this event.
    if (error.code === '23505') {
      const existing = await supabase
        .from('subscription_events').select('*').eq('id', evt.id).maybeSingle();
      return { created: false, event: existing.data ? rowToCamel(existing.data, SUBSCRIPTION_EVENT_FIELDS) : null };
    }
    throw error;
  }
  return { created: true, event: rowToCamel(data, SUBSCRIPTION_EVENT_FIELDS) };
}

async function markSubscriptionEventProcessed(id, errorText) {
  const { error } = await supabase
    .from('subscription_events')
    .update({ processed_at: new Date().toISOString(), error: errorText || null })
    .eq('id', id);
  if (error) throw error;
}

// Write the current state of a subscription onto the profiles.subscription_*
// mirror (0025 + 0029 columns) so db.resolveForUser /
// subscriptionService.computeStatus — the single source of premium truth —
// see it without ever reading the `subscriptions` table. `mirror` is the
// already-resolved shape the billing service computed.
async function mirrorSubscriptionToProfile(userId, mirror) {
  const patch = {
    subscriptionType: mirror.subscriptionType,
    subscriptionUpdatedAt: new Date().toISOString(),
  };
  if (mirror.trialStartedAt !== undefined) patch.trialStartedAt = mirror.trialStartedAt;
  if (mirror.trialEndsAt !== undefined) patch.trialEndsAt = mirror.trialEndsAt;
  if (mirror.subscriptionStartedAt !== undefined) patch.subscriptionStartedAt = mirror.subscriptionStartedAt;
  if (mirror.subscriptionEndsAt !== undefined) patch.subscriptionEndsAt = mirror.subscriptionEndsAt;
  if (mirror.billingPeriod !== undefined) patch.subscriptionBillingPeriod = mirror.billingPeriod;
  if (mirror.priceAtPurchase !== undefined) patch.subscriptionPriceAtPurchase = mirror.priceAtPurchase;
  if (mirror.currency !== undefined) patch.subscriptionCurrency = mirror.currency;
  if (mirror.provider !== undefined) patch.subscriptionProvider = mirror.provider;
  if (mirror.providerCustomerId !== undefined) patch.subscriptionProviderCustomerId = mirror.providerCustomerId;
  if (mirror.providerSubscriptionId !== undefined) patch.subscriptionProviderSubscriptionId = mirror.providerSubscriptionId;
  if (mirror.currentPeriodStart !== undefined) patch.subscriptionCurrentPeriodStart = mirror.currentPeriodStart;
  if (mirror.currentPeriodEnd !== undefined) patch.subscriptionCurrentPeriodEnd = mirror.currentPeriodEnd;
  if (mirror.cancelAtPeriodEnd !== undefined) patch.subscriptionCancelAtPeriodEnd = mirror.cancelAtPeriodEnd;
  return updateProfile(userId, patch);
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

// Receipt/bill scanner usage — a single per-user row carrying a lifetime
// total (the Free tier's cap is a LIFETIME 3, see receiptScanPolicy.js) plus
// a rolling window total for paid tiers. Separate from ai_usage so a scan
// cap and an AI-request cap never bleed into each other. Degrades to "no
// counts" if 0027 hasn't been applied yet, same tolerance as
// getSessionBySessionId for 0022.
//
// Returns { lifetimeCount, windowKey, windowCount } — the caller
// (services/receiptScanQuota.js) decides which one the user's plan cares
// about and whether windowKey is still current.
async function getReceiptScanCounters(userId) {
  try {
    const { data, error } = await supabase
      .from('receipt_scan_totals')
      .select('lifetime_count, window_key, window_count')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return {
      lifetimeCount: data ? data.lifetime_count : 0,
      windowKey: data ? data.window_key : null,
      windowCount: data ? data.window_count : 0,
    };
  } catch (err) {
    if (isMissingTableError(err)) return { lifetimeCount: 0, windowKey: null, windowCount: 0, unavailable: true };
    throw err;
  }
}

// Records ONE completed scan (a whole multi-image scan counts as one). Bumps
// the lifetime total always; bumps the window total, resetting it first when
// `windowKey` has rolled over since the last scan. Call this only AFTER the
// vision call succeeds — a failed/blurry upload must never burn a scan.
async function bumpReceiptScanCounter(userId, windowKey) {
  // Preferred path: a single atomic statement in Postgres (0028_receipt_scan
  // _increment_fn.sql) — INSERT ... ON CONFLICT DO UPDATE ... RETURNING, so
  // two concurrent scans from the same user can never lose an increment the
  // way a read-then-upsert can. The route's in-process per-user queue covers
  // the single-instance case; this covers horizontal scaling too.
  try {
    const { data, error } = await supabase.rpc('increment_receipt_scan', {
      p_user_id: userId,
      p_window_key: windowKey,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (row) {
      return {
        lifetimeCount: row.lifetime_count,
        windowKey: row.window_key,
        windowCount: row.window_count,
      };
    }
  } catch (err) {
    if (isMissingTableError(err)) return { lifetimeCount: 0, windowKey, windowCount: 0, unavailable: true };
    if (!isMissingFunctionError(err)) throw err;
    // RPC not deployed yet — fall through to the non-atomic upsert below.
  }

  // Fallback (pre-0028): read-modify-write upsert. Byte-identical to the
  // original implementation; safe because the route serializes a single
  // user's scans in-process.
  try {
    const cur = await getReceiptScanCounters(userId);
    const sameWindow = cur.windowKey === windowKey;
    const row = {
      user_id: userId,
      lifetime_count: cur.lifetimeCount + 1,
      window_key: windowKey,
      window_count: (sameWindow ? cur.windowCount : 0) + 1,
      updated_at: new Date().toISOString(),
    };
    if (cur.lifetimeCount === 0) row.first_scan_at = new Date().toISOString();
    const { error } = await supabase.from('receipt_scan_totals').upsert(row, { onConflict: 'user_id' });
    if (error) throw error;
    return { lifetimeCount: row.lifetime_count, windowKey, windowCount: row.window_count };
  } catch (err) {
    if (isMissingTableError(err)) return { lifetimeCount: 0, windowKey, windowCount: 0, unavailable: true };
    throw err;
  }
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
  getSubscriptionSettings,
  updateSubscriptionSettings,
  resolveForUser,
  getSubscriptionPrices,
  upsertSubscriptionPrice,
  deleteSubscriptionPrice,
  subscriptionPricingMigrated,
  resolvePricingForUser,
  subscriptionBillingMigrated,
  getLiveSubscriptionForUser,
  getSubscriptionByProviderId,
  listSubscriptionsForUser,
  upsertSubscriptionRecord,
  recordSubscriptionEvent,
  markSubscriptionEventProcessed,
  mirrorSubscriptionToProfile,
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
  getReceiptScanCounters,
  bumpReceiptScanCounter,
  listConversations,
  getConversation,
  listMessages,
  insertMessage,
  touchConversation,
  deleteOldConversations,
  AI_HISTORY_RETENTION_DAYS,
  insertCategory: categoryHelpers.insert, updateCategory: categoryHelpers.update, deleteCategory: categoryHelpers.remove,
  upsertCategory: categoryHelpers.upsert,
  insertAccount: accountHelpers.insert, updateAccount: accountHelpers.update, deleteAccount: accountHelpers.remove,
  upsertAccount: accountHelpers.upsert,
  unsetOtherPrimaryAccounts,
  insertTransaction: transactionHelpers.insert, updateTransaction: transactionHelpers.update, deleteTransaction: transactionHelpers.remove,
  upsertTransaction: transactionHelpers.upsert,
  insertBudget: budgetHelpers.insert, updateBudget: budgetHelpers.update, deleteBudget: budgetHelpers.remove,
  upsertBudget: budgetHelpers.upsert,
  insertBill: billHelpers.insert, updateBill: billHelpers.update, deleteBill: billHelpers.remove,
  insertGoal: goalHelpers.insert, updateGoal: goalHelpers.update, deleteGoal: goalHelpers.remove,
  upsertGoal: goalHelpers.upsert,
  getChangesSince,
  insertDebt: debtHelpers.insert, updateDebt: debtHelpers.update, deleteDebt: debtHelpers.remove,
  insertTemplate: templateHelpers.insert, updateTemplate: templateHelpers.update, deleteTemplate: templateHelpers.remove,
  insertConversation: conversationHelpers.insert, updateConversation: conversationHelpers.update, deleteConversation: conversationHelpers.remove,
  // Exported so adminDb.js's cross-user listUsers() can map `profiles` rows
  // with the exact same field convention instead of duplicating it.
  PROFILE_FIELDS,
};
