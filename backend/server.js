require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const compression = require('compression');
const crypto = require('crypto');
const { supabase } = require('./supabaseClient');
const db = require('./db');
const adminDb = require('./adminDb');
const adminRoutes = require('./routes/admin');
const { parseDevice } = require('./lib/deviceParser');
const plans = require('./plans');
const {
  iso, sortTransactionsRecentFirst, addDaysFromToday, round1, numOr, signAmount,
  categoryIdByName, startOfWeek, budgetWindow, budgetTransactionsInWindow,
  computeBudgetSpent, categorySpendForMonth,
} = require('./services/shared');
const {
  computeLedger, computeAccounts, computeCategories,
  buildSpendingTrend, buildTagTrend, buildCategorySpend, buildMetrics,
} = require('./services/metricsService');
const { gradeFor, computeHealth } = require('./services/healthScoreEngine');
const { computeBudgetPredictions, computeUnusedBudgets, recommendBudgetAdjustments } = require('./services/budgetAnalysisService');
const { computeCashFlowForecast, computeSmartSavings, computeLowBalanceAlert } = require('./services/forecastService');
const {
  computeYearOverYear, computeAverageDailySpending, computeAverageMonthlySavings,
  computeWeekendVsWeekday, computeMostAndLeastExpensiveMonth,
  computeTopSpendingCategories, computeTopMerchants,
} = require('./services/cashFlowAnalysisService');
const {
  computeSpendingInsights, computeDuplicateAlerts, computeRecurringPatterns,
  computeAnomalies, computeLargeExpenseAlerts, largestRecentExpense, SUBSCRIPTION_VENDOR_HINTS,
} = require('./services/spendingAnalysisService');
const { computeGoalInsights, computeGoalCompletionForecast, computeRequiredMonthlyContribution } = require('./services/goalAnalysisService');
const { upcomingBills, computeBillPaymentHistory } = require('./services/billAnalysisService');
const { mkNotif, computeGeneratedRows, generateNotificationsFor } = require('./services/notificationEngine');
const { computeDailySummary, computeMonthlyAIReport, computeWeeklySummary } = require('./services/financialInsightsService');
const { buildRecommendations } = require('./services/recommendationEngine');
const insightsCache = require('./services/cache');

const PORT = process.env.PORT || 4000;
// Comma-separated list of allowed browser origins, e.g. "https://app.example.com,https://example.com".
// Empty/unset falls back to allowing any origin (fine for local dev, not for production).
const CORS_ORIGINS = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);

function securityLog(event, details) {
  console.warn(`[security] ${event}`, JSON.stringify(details));
}

// Reads a JWT's `iat` claim without verifying the signature — verification
// already happened via supabase.auth.getUser(token) just before this is
// called. Used only to compare against profiles.sessions_invalidated_at for
// Force Logout (see backend/routes/admin/users.js — there's no documented
// Supabase Admin API call to invalidate a specific user's existing sessions
// by id, so this is the portable mechanism instead).
function decodeJwtIssuedAt(token) {
  try {
    const payload = token.split('.')[1];
    const json = Buffer.from(payload, 'base64url').toString('utf8');
    const claims = JSON.parse(json);
    return typeof claims.iat === 'number' ? claims.iat * 1000 : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------
// (iso, sortTransactionsRecentFirst, addDaysFromToday, round1, numOr,
// signAmount, categoryIdByName now live in ./services/shared, required above
// — this file destructures the same identifiers so every call site below is
// unchanged.)
function isValidDateStr(s) {
  return typeof s === 'string' && s.trim() !== '' && !Number.isNaN(new Date(s).getTime());
}
// Empty-string Select values ("— None —" / "Select account") must become
// NULL for uuid-typed FK columns, or Postgres rejects the write outright:
// 'invalid input syntax for type uuid: ""'. Every POST route already builds
// its insert payload with `field || null` for these; PATCH routes instead
// copy body fields into a generic patch object field-by-field and need the
// same coercion applied per-field there.
function emptyToNull(value) {
  return value === '' ? null : value;
}
function ownsAccount(userData, id) {
  return !id || userData.accounts.some((a) => a.id === id);
}
function foreignAccountField(userData, body, fields) {
  return fields.find((field) => body[field] && !ownsAccount(userData, body[field])) || null;
}
function advanceDate(dateStr, frequency) {
  const d = new Date(dateStr);
  switch (frequency) {
    case 'daily':
      d.setDate(d.getDate() + 1);
      break;
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1);
      break;
    case 'monthly':
    default:
      d.setMonth(d.getMonth() + 1);
      break;
  }
  return iso(d);
}
// Rolls a due date forward, one cycle at a time, until it's no longer in the
// past. Applied whenever a bill's autoPost is being turned on: without this,
// enabling auto-post on a bill someone backdated (e.g. logging June's rent
// bill in September) would make the catch-up sweep in
// processAutoPostBillsForUser immediately post one transaction for every
// missed cycle between then and today. Auto-post must only ever affect
// future occurrences — see FEATURES.md's Recurring & Bills business rules.
function nextFutureDueDate(dueDate, frequency) {
  const today = iso(new Date());
  let next = dueDate;
  let guard = 0;
  while (next < today && guard < 1000) {
    next = advanceDate(next, frequency);
    guard++;
  }
  return next;
}

// ---------------------------------------------------------------------------
// response cache-busting — bumped whenever any write happens, so sendJSON's
// ETag changes and clients don't get a stale 304 for data that just changed,
// and so the per-user compute cache (services/cache.js) invalidates the
// health-score/AI-insights/AI-monthly-report bundles it may have cached for
// this user. Called at the end of every mutating route with req.userId.
// ---------------------------------------------------------------------------
let etagBase = Date.now();
function bumpCache(userId) {
  etagBase = Date.now();
  insightsCache.touch(userId);
}

// ---------------------------------------------------------------------------
// auto-post engine
// ---------------------------------------------------------------------------
// `extraLabels` are system tags the caller wants stamped on top (e.g.
// 'auto-post', 'bill-payment') — merged with the bill's own tags/labels
// (set in the Add/Edit bill form's Tags field) rather than replacing them,
// so a bill tagged "Savings" still shows that tag on the transaction it
// posts, not just the system tag.
function buildBillTransaction(bill, { note, extraLabels = [] }) {
  const isTransfer = bill.type === 'transfer';
  const labels = [...new Set([...(bill.labels || []), ...extraLabels])];
  return {
    date: bill.dueDate,
    vendor: bill.vendor || bill.name,
    categoryId: bill.categoryId || null,
    amount: isTransfer ? Math.abs(numOr(bill.amount)) : signAmount(bill.type, bill.amount),
    type: bill.type,
    paymentMethod: bill.paymentMethod || 'Bank Transfer',
    note,
    labels,
    sourceBillId: bill.id,
    ...(isTransfer ? { fromAccountId: bill.fromAccountId, toAccountId: bill.toAccountId } : { accountId: bill.accountId }),
  };
}
// Inserts the generated transaction via db.insertTransaction (Postgres
// assigns the real id) and writes the bill's advanced dueDate/status/active/
// lastRun via db.updateBill, while also mirroring both changes into the
// already-fetched in-memory userData arrays so the rest of the same request
// sees them without a re-fetch (mirrors the old single-process-memory model).
async function postBillTransaction(userId, userData, bill) {
  // Captured before advanceDate mutates bill.dueDate below — see
  // 0007_bill_payments.sql's comment on why this can't be reconstructed
  // after the fact from the bill's (now-rolled-forward) current due date.
  const dueDateAtPayment = bill.dueDate;
  const txn = await db.insertTransaction(userId, buildBillTransaction(bill, { note: `${bill.note ? bill.note + ' · ' : ''}[auto-post]`, extraLabels: ['auto-post'] }));
  userData.transactions.push(txn);
  const paidDate = iso(new Date());
  const patch = {};
  if (bill.frequency === 'one-time') {
    bill.status = 'paid';
    bill.active = false;
    patch.status = 'paid';
    patch.active = false;
  } else {
    bill.dueDate = advanceDate(bill.dueDate, bill.frequency);
    patch.dueDate = bill.dueDate;
  }
  bill.lastRun = new Date().toISOString();
  patch.lastRun = bill.lastRun;
  await db.updateBill(userId, bill.id, patch);
  const paymentLog = await db.insertBillPayment(userId, {
    billId: bill.id, transactionId: txn.id,
    dueDateAtPayment, paidDate, wasLate: paidDate > dueDateAtPayment,
  });
  userData.billPayments.push(paymentLog);
  return txn;
}
// Runs on *every* authenticated request (see requireAuth below), so it sits
// directly in front of every page load's latency. Catching up N overdue
// bills used to await each one's insert+update round trips strictly in
// sequence — one user with several months of backlog across a few bills
// could add seconds to every single API call, not just the first. Each
// bill's own catch-up (dueDate must advance one cycle at a time) still has
// to stay sequential internally, but different bills don't depend on each
// other, so they now run concurrently via Promise.all instead of one after
// another.
async function processAutoPostBillsForUser(userId, userData) {
  const today = iso(new Date());
  const due = (userData.bills || []).filter((bill) => bill.autoPost && bill.active !== false);

  const generatedCounts = await Promise.all(due.map(async (bill) => {
    if (!isValidDateStr(bill.dueDate)) {
      console.warn(`[auto-post] skipping bill ${bill.id} — invalid dueDate: ${JSON.stringify(bill.dueDate)}`);
      return 0;
    }
    let generated = 0;
    let iterations = 0;
    try {
      while (bill.active !== false && bill.dueDate <= today && iterations < 24) {
        await postBillTransaction(userId, userData, bill);
        generated++;
        iterations++;
      }
    } catch (err) {
      console.warn(`[auto-post] error processing bill ${bill.id}:`, err.message);
    }
    return generated;
  }));

  return { active: due.length, generated: generatedCounts.reduce((a, b) => a + b, 0) };
}

// ---------------------------------------------------------------------------
// dashboard layout persistence — validated shallowly so a malformed client
// payload can't corrupt the saved file; unknown/invalid entries are dropped
// rather than rejecting the whole request outright.
// ---------------------------------------------------------------------------
function sanitizeWidgetList(list) {
  if (!Array.isArray(list)) return null;
  return list
    .filter((w) => w && typeof w.id === 'string' && typeof w.type === 'string')
    .map((w) => ({ id: w.id, type: w.type, span: Number.isFinite(w.span) ? w.span : 1 }))
    .slice(0, 40);
}
function sanitizeDashboardLayoutPayload(body) {
  if (!body || typeof body !== 'object' || !body.presets || typeof body.presets !== 'object') return null;
  const presets = {};
  Object.entries(body.presets).forEach(([name, list]) => {
    if (typeof name !== 'string' || !name.trim()) return;
    const clean = sanitizeWidgetList(list);
    if (clean) presets[name] = clean;
  });
  const names = Object.keys(presets);
  if (!names.length) return null;
  const active = typeof body.active === 'string' && presets[body.active] ? body.active : names[0];
  return { active, presets };
}

// ---------------------------------------------------------------------------
// express app
// ---------------------------------------------------------------------------
const app = express();

// Behind a reverse proxy / load balancer (typical in production), trust its
// X-Forwarded-For so req.ip and the rate limiter key on the real client IP
// instead of the proxy's. Only enable this if you actually sit behind one —
// trusting it blindly on a directly-exposed server lets clients spoof their IP.
if (process.env.TRUST_PROXY) app.set('trust proxy', 1);

app.use(helmet());
app.use(compression());
app.use(cors(CORS_ORIGINS.length ? { origin: CORS_ORIGINS } : {}));
app.use(morgan('dev'));
app.use(express.json({ limit: '5mb' }));

// Blanket API abuse guard. Auth itself is handled by Supabase (not a route
// on this server), so there's no separate auth-specific limiter here.
//
// `skip` only fires when NODE_ENV is explicitly 'development' — an opt-in,
// not the default — so an unset/misconfigured NODE_ENV in production fails
// safe (limiter stays on) rather than silently disabling itself. Local dev
// now runs two frontend apps plus hot-reload against one backend, which
// burns through 300 req/15min fast; production behavior is unchanged.
const API_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const API_RATE_LIMIT_MAX = 300;
const isDevEnv = process.env.NODE_ENV === 'development';
const apiLimiter = rateLimit({
  windowMs: API_RATE_LIMIT_WINDOW_MS,
  max: API_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDevEnv,
});
app.use('/api', apiLimiter);

// Super Admin Panel — a fully separate auth boundary (requireAdminAuth,
// applied once inside this router) from the consumer requireAuth below.
// See backend/routes/admin/index.js and the plan doc for the full design.
app.use('/api/admin', adminRoutes);

function sendJSON(req, res, payload) {
  const key = `${etagBase}:${req.userId || 'anon'}:${req.originalUrl}`;
  const etag = 'W/"' + crypto.createHash('sha1').update(key).digest('hex') + '"';
  res.set('Cache-Control', 'private, no-cache');
  res.set('ETag', etag);
  if (req.headers['if-none-match'] === etag) {
    res.status(304).end();
    return;
  }
  res.json(payload);
}

// Express 4 doesn't forward a rejected promise from an async handler to the
// error-handling middleware on its own — this thin wrapper does, so every
// async route below gets the same never-leak-a-stack-trace 500 handling as
// the rest of the app instead of a hung request or an unhandled rejection.
function ah(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// Reproduces the exact response shape the old file-store's safeUser() sent
// (id, name, email, phone, avatar, currency, currencySymbol, memberSince,
// plan, healthScore, healthGrade, twoFactorEnabled, biometricEnabled) —
// email now comes from the verified Supabase Auth user, everything else
// from the profiles row.
function buildSafeUser(userId, email, profile, impersonation, isAdmin) {
  const planConfig = plans.getPlanConfig(profile?.plan);
  return {
    id: userId,
    name: profile?.name ?? '',
    email,
    phone: profile?.phone ?? '',
    avatar: profile?.avatar ?? '',
    currency: profile?.currency ?? 'INR',
    currencySymbol: profile?.currencySymbol ?? '₹',
    country: profile?.country ?? null,
    memberSince: profile?.memberSince ?? null,
    plan: profile?.plan ?? 'Free',
    healthScore: profile?.healthScore ?? 0,
    healthGrade: profile?.healthGrade ?? '—',
    twoFactorEnabled: !!profile?.twoFactorEnabled,
    biometricEnabled: !!profile?.biometricEnabled,
    // Our own source of truth for "can this account log in with a password"
    // — see POST /api/me/password-set and 0003_has_password.sql for why this
    // isn't derived from Supabase's identities/AMR data.
    hasPassword: !!profile?.hasPassword,
    feedbackPromptSnoozedUntil: profile?.feedbackPromptSnoozedUntil ?? null,
    feedbackPromptDisabled: !!profile?.feedbackPromptDisabled,
    // Resolved once here from plans.js (the single source of truth) so the
    // frontend never needs its own copy of plan/feature rules. limits uses
    // null (not Infinity — JSON can't represent it) to mean "no limit".
    features: planConfig.features,
    limits: plans.serializableLimits(profile?.plan),
    // Drives the consumer app's impersonation banner (ImpersonationBanner.jsx)
    // — null when nobody is impersonating this account right now.
    impersonation: impersonation
      ? { active: true, adminName: impersonation.adminName, expiresAt: impersonation.expiresAt, sessionId: impersonation.id }
      : null,
    // Drives the "Super Admin" button in the consumer app's Topbar — only
    // ever a UI-visibility signal, never an authorization decision (see
    // requireAuth's comment on req.isAdmin).
    isAdmin: !!isAdmin,
  };
}

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'unauthorized' });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      securityLog('invalid_or_expired_token', { ip: req.ip, path: req.path });
      return res.status(401).json({ error: 'unauthorized' });
    }
    req.userId = data.user.id;
    req.userEmail = data.user.email;
    req.token = token;
    req.userData = await db.getUserBundle(req.userId);
    req.userPlan = req.userData.plan;

    // Suspension (admin panel's User Management) — re-checked on every
    // request, not just login, since a JWT issued before a suspension
    // doesn't reflect it.
    if (req.userData.status === 'suspended') {
      securityLog('suspended_account_blocked', { userId: req.userId, path: req.path });
      return res.status(403).json({ error: 'account_suspended' });
    }
    // Force Logout — see decodeJwtIssuedAt's comment for why this exists
    // instead of an Admin API call.
    if (req.userData.sessionsInvalidatedAt) {
      const issuedAtMs = decodeJwtIssuedAt(token);
      const invalidatedMs = new Date(req.userData.sessionsInvalidatedAt).getTime();
      if (issuedAtMs !== null && issuedAtMs < invalidatedMs) {
        securityLog('force_logout_token_rejected', { userId: req.userId, path: req.path });
        return res.status(401).json({ error: 'session_revoked' });
      }
    }
    // Surfaces to buildSafeUser so the consumer app can render its
    // impersonation banner — the actual expiry enforcement (independent of
    // the Supabase JWT's own TTL) is this same lookup. isAdmin alongside it
    // is UI-visibility only (the topbar's "Super Admin" button) — every
    // /api/admin/* route still independently re-verifies via
    // requireAdminAuth regardless of what this flag says.
    [req.impersonation, req.isAdmin] = await Promise.all([
      adminDb.getActiveImpersonationSession(req.userId),
      adminDb.isActiveAdmin(req.userId),
    ]);

    // Catch up any auto-post bills that came due since this user's last
    // authenticated request. There's no more single in-memory blob to sweep
    // at server boot, so that pass is gone (see boot section) — every user
    // self-catches-up here on their next request instead.
    await processAutoPostBillsForUser(req.userId, req.userData);
    next();
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// plan enforcement — thin wrappers around plans.js, the single source of
// truth for what each plan allows. Nowhere else should compare a plan name
// or a limit number directly.
// ---------------------------------------------------------------------------
function requireFeature(flag) {
  return (req, res, next) => {
    if (!plans.can(req.userPlan, flag)) {
      return res.status(403).json({ error: 'upgrade_required', feature: flag });
    }
    next();
  };
}
// Used inline (not as middleware) right before an insert, since the current
// count of the resource is already sitting in req.userData from requireAuth
// — no extra query needed. Sends the 403 itself; caller just checks the
// return value and stops if false.
function assertUnderLimit(req, res, limitKey, currentCount) {
  const limit = plans.limitFor(req.userPlan, limitKey);
  if (currentCount >= limit) {
    res.status(403).json({ error: 'upgrade_required', limit: limitKey });
    return false;
  }
  return true;
}

// ---- health (public) ----
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'wallet-backend', time: new Date().toISOString() });
});

// ---- auth ----
// Signup/login/logout/Google sign-in now happen client-side against Supabase
// Auth directly (see frontend/src/lib/api.js, AuthContext.jsx) — this backend
// only ever verifies the resulting Supabase JWT (see requireAuth above).

app.get('/api/me', requireAuth, ah(async (req, res) => {
  const profile = await db.getProfile(req.userId);
  res.json({ user: buildSafeUser(req.userId, req.userEmail, profile, req.impersonation, req.isAdmin) });
}));

app.patch('/api/me', requireAuth, ah(async (req, res) => {
  const body = req.body || {};
  const patch = {};
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length === 0 || body.name.length > 100) {
      return res.status(400).json({ error: 'name must be 1-100 characters' });
    }
    patch.name = body.name.trim();
  }
  if (body.phone !== undefined) {
    if (typeof body.phone !== 'string' || body.phone.length > 30) {
      return res.status(400).json({ error: 'phone must be at most 30 characters' });
    }
    patch.phone = body.phone.trim();
  }
  if (body.country !== undefined) {
    if (body.country !== null && (typeof body.country !== 'string' || body.country.length > 2)) {
      return res.status(400).json({ error: 'country must be a 2-letter code' });
    }
    patch.country = body.country;
  }
  if (body.currency !== undefined) {
    if (typeof body.currency !== 'string' || body.currency.length !== 3) {
      return res.status(400).json({ error: 'currency must be a 3-letter ISO code' });
    }
    patch.currency = body.currency.toUpperCase();
  }
  if (body.currencySymbol !== undefined) {
    if (typeof body.currencySymbol !== 'string' || body.currencySymbol.length === 0 || body.currencySymbol.length > 10) {
      return res.status(400).json({ error: 'currencySymbol must be 1-10 characters' });
    }
    patch.currencySymbol = body.currencySymbol;
  }
  // Feedback popup dismissal — "Remind me later" (snooze) / "Don't ask
  // again" (disable). Persisted here (not just localStorage) so dismissing
  // on one device carries over to another.
  if (body.feedbackPromptSnoozedUntil !== undefined) {
    if (body.feedbackPromptSnoozedUntil !== null && Number.isNaN(Date.parse(body.feedbackPromptSnoozedUntil))) {
      return res.status(400).json({ error: 'feedbackPromptSnoozedUntil must be a valid date or null' });
    }
    patch.feedbackPromptSnoozedUntil = body.feedbackPromptSnoozedUntil;
  }
  if (body.feedbackPromptDisabled !== undefined) {
    patch.feedbackPromptDisabled = !!body.feedbackPromptDisabled;
  }
  const profile = Object.keys(patch).length ? await db.updateProfile(req.userId, patch) : await db.getProfile(req.userId);
  res.json(buildSafeUser(req.userId, req.userEmail, profile, req.impersonation, req.isAdmin));
}));

// Marks this account as having a working password — called by the frontend
// right after a successful updateUser({password}) (Create Password / change
// password in Settings), and also after any successful password login, as a
// self-healing backfill for accounts whose password predates this flag.
// Idempotent; no request body.
app.post('/api/me/password-set', requireAuth, ah(async (req, res) => {
  await db.updateProfile(req.userId, { hasPassword: true });
  res.json({ ok: true });
}));

// ---- feedback (consumer submission -> admin triage inbox) ----
// 'general_message' covers "Message Super Admin" — a direct message with no
// bug/feature framing — reusing this same table/category rather than a
// separate schema, since triage/reply/status all work identically for it.
const FEEDBACK_CATEGORIES = [
  'bug', 'feature_request', 'suggestion', 'complaint', 'performance', 'payment_issue',
  'ai_assistant', 'voice_entry', 'ui_ux', 'sync_issue', 'security', 'billing', 'general_message', 'other',
];
app.post('/api/feedback', requireAuth, ah(async (req, res) => {
  const body = req.body || {};
  const category = FEEDBACK_CATEGORIES.includes(body.category) ? body.category : 'other';
  const subject = typeof body.subject === 'string' ? body.subject.trim().slice(0, 200) : '';
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 5000) : '';
  if (!subject || !message) return res.status(400).json({ error: 'subject_and_message_required' });
  const rating = Number.isInteger(body.rating) && body.rating >= 1 && body.rating <= 5 ? body.rating : null;
  const priority = ['low', 'normal', 'high', 'urgent'].includes(body.priority) ? body.priority : 'normal';
  const profile = await db.getProfile(req.userId);
  const created = await adminDb.createFeedback({
    userId: req.userId,
    userEmail: req.userEmail || '',
    userName: profile?.name || '',
    category, subject, message, rating, priority,
    platform: 'web',
  });
  res.status(201).json(created);
}));

// The user's own tickets — never the full admin inbox (adminDb.listFeedback
// is cross-user by default; passing userId scopes it, same idea as
// db.js's per-table user_id scoping for every other entity).
app.get('/api/feedback', requireAuth, ah(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 25));
  const { rows, total } = await adminDb.listFeedback({ page, pageSize, userId: req.userId });
  res.json({ rows, total, page, pageSize });
}));

app.get('/api/feedback/:id', requireAuth, ah(async (req, res) => {
  const item = await adminDb.getFeedback(req.params.id);
  if (!item || item.userId !== req.userId) return res.status(404).json({ error: 'not_found' });
  const messages = await adminDb.listFeedbackMessages(req.params.id, { includeInternal: false });
  // Opening the conversation is what "read" means here — clears the
  // "support replied" notification generated in notificationEngine.js.
  await adminDb.markFeedbackRead(req.params.id);
  res.json({ ...item, messages });
}));

app.post('/api/feedback/:id/messages', requireAuth, ah(async (req, res) => {
  const item = await adminDb.getFeedback(req.params.id);
  if (!item || item.userId !== req.userId) return res.status(404).json({ error: 'not_found' });
  const body = typeof req.body?.body === 'string' ? req.body.body.trim().slice(0, 5000) : '';
  if (!body) return res.status(400).json({ error: 'body_required' });
  const message = await adminDb.addFeedbackMessage({ feedbackId: req.params.id, senderType: 'user', userSenderId: req.userId, body, internal: false });
  // Symmetric with the admin side's open -> in_progress auto-transition on
  // reply: the user replying out of "waiting for user" naturally hands the
  // ticket back to the support queue.
  if (item.status === 'waiting_for_user') await adminDb.updateFeedback(req.params.id, { status: 'in_progress' });
  await adminDb.markFeedbackRead(req.params.id);
  res.status(201).json(message);
}));

// The "Yes, issue fixed" / "No, still having issue" confirmation step —
// only valid once support has marked a ticket resolved.
app.post('/api/feedback/:id/confirm', requireAuth, ah(async (req, res) => {
  const item = await adminDb.getFeedback(req.params.id);
  if (!item || item.userId !== req.userId) return res.status(404).json({ error: 'not_found' });
  if (item.status !== 'resolved') return res.status(400).json({ error: 'not_resolved' });
  const confirmed = !!req.body?.confirmed;
  const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim().slice(0, 2000) : '';
  const rating = Number.isInteger(req.body?.rating) && req.body.rating >= 1 && req.body.rating <= 5 ? req.body.rating : null;

  if (confirmed) {
    await adminDb.updateFeedback(req.params.id, { status: 'closed', closedAt: new Date().toISOString(), satisfactionRating: rating });
    await adminDb.addFeedbackMessage({ feedbackId: req.params.id, senderType: 'system', userSenderId: req.userId, body: 'User confirmed the issue is fixed. Ticket closed.', internal: false });
  } else {
    await adminDb.updateFeedback(req.params.id, { status: 'reopened' });
    await adminDb.addFeedbackMessage({ feedbackId: req.params.id, senderType: 'system', userSenderId: req.userId, body: 'User reported the issue is still occurring. Ticket reopened.', internal: false });
  }
  if (comment) {
    await adminDb.addFeedbackMessage({ feedbackId: req.params.id, senderType: 'user', userSenderId: req.userId, body: comment, internal: false });
  }
  const after = await adminDb.getFeedback(req.params.id);
  res.json(after);
}));

// ---- login events (DAU/MAU, Last Login, Login History, Devices) ----
app.post('/api/login-events', requireAuth, ah(async (req, res) => {
  const method = ['password', 'google', 'impersonation'].includes(req.body?.method) ? req.body.method : 'password';
  const userAgent = req.headers['user-agent'] || null;
  await adminDb.recordLoginEvent({
    userId: req.userId, method, ip: req.ip, userAgent, device: parseDevice(userAgent),
  });
  res.status(201).json({ ok: true });
}));

// User-initiated "exit impersonation" — the admin-side force-end lives at
// POST /api/admin/impersonation/:id/revoke. This ends the same row.
app.post('/api/impersonation/end', requireAuth, ah(async (req, res) => {
  if (!req.impersonation) return res.json({ ok: true });
  await adminDb.endImpersonationSession(req.impersonation.id, 'manual_exit');
  res.json({ ok: true });
}));

// ---- dashboard ----
app.get('/api/dashboard', requireAuth, ah(async (req, res) => {
  const userData = req.userData;
  const profile = await db.getProfile(req.userId);
  const user = buildSafeUser(req.userId, req.userEmail, profile, req.impersonation, req.isAdmin);
  const accounts = computeAccounts(userData);
  const metrics = buildMetrics(userData, accounts);
  const spendingTrend = buildTagTrend(userData.transactions, 7);
  const categorySpend = buildCategorySpend(userData.transactions, userData.categories);
  const recentTransactions = sortTransactionsRecentFirst(userData.transactions).slice(0, 8);
  const upcomingBills = [...userData.bills].filter((b) => b.status === 'pending').sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).slice(0, 5);
  const health = await insightsCache.getOrCompute(req.userId, 'health', () => computeHealth(userData, accounts));
  sendJSON(req, res, {
    user, metrics, spendingTrend, categorySpend,
    recentTransactions, upcomingBills, goals: userData.goals,
    accounts, healthScore: health.score, healthGrade: health.grade,
    healthBreakdown: health.breakdown,
  });
}));

// ---- dashboard layout (custom widget grid, persisted per user, synced across devices) ----
app.get('/api/dashboard-layout', requireAuth, (req, res) => sendJSON(req, res, req.userData.dashboardLayout));

app.put('/api/dashboard-layout', requireAuth, ah(async (req, res) => {
  const sanitized = sanitizeDashboardLayoutPayload(req.body);
  if (!sanitized) return res.status(400).json({ error: 'invalid layout payload' });
  await db.updateProfile(req.userId, { dashboardLayout: sanitized });
  req.userData.dashboardLayout = sanitized;
  bumpCache(req.userId);
  res.json(sanitized);
}));

// ---- categories ----
app.get('/api/categories', requireAuth, (req, res) => sendJSON(req, res, computeCategories(req.userData)));

app.post('/api/categories', requireAuth, ah(async (req, res) => {
  const { name, icon, color, parentId } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  if (parentId) {
    const parent = req.userData.categories.find((c) => c.id === parentId);
    if (!parent) return res.status(400).json({ error: 'parent category not found' });
    if (parent.parentId) return res.status(400).json({ error: 'cannot nest under a sub-category' });
  }
  const cat = await db.insertCategory(req.userId, { name, icon: icon || 'Circle', color: color || '#6366f1', parentId: parentId || null });
  req.userData.categories.push(cat);
  bumpCache(req.userId);
  res.status(201).json(cat);
}));

app.patch('/api/categories/:id', requireAuth, ah(async (req, res) => {
  const cat = req.userData.categories.find((c) => c.id === req.params.id);
  if (!cat) return res.status(404).json({ error: 'not found' });
  const { name, icon, color, parentId } = req.body || {};
  if (parentId !== undefined && parentId) {
    if (parentId === cat.id) return res.status(400).json({ error: 'a category cannot be its own parent' });
    const parent = req.userData.categories.find((c) => c.id === parentId);
    if (!parent) return res.status(400).json({ error: 'parent category not found' });
    if (parent.parentId) return res.status(400).json({ error: 'cannot nest under a sub-category' });
    const hasChildren = req.userData.categories.some((c) => c.parentId === cat.id);
    if (hasChildren) return res.status(400).json({ error: 'category with sub-categories cannot become a sub-category' });
  }
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (icon !== undefined) patch.icon = icon;
  if (color !== undefined) patch.color = color;
  if (parentId !== undefined) patch.parentId = parentId || null;
  Object.assign(cat, patch);
  if (Object.keys(patch).length) await db.updateCategory(req.userId, cat.id, patch);
  bumpCache(req.userId);
  res.json(cat);
}));

app.delete('/api/categories/:id', requireAuth, ah(async (req, res) => {
  const { id } = req.params;
  const inUse =
    req.userData.transactions.some((t) => t.categoryId === id) ||
    req.userData.budgets.some((b) => b.categoryId === id) ||
    req.userData.categories.some((c) => c.parentId === id);
  if (inUse) return res.status(409).json({ error: 'in_use' });
  await db.deleteCategory(req.userId, id);
  req.userData.categories = req.userData.categories.filter((c) => c.id !== id);
  bumpCache(req.userId);
  res.json({ ok: true });
}));

// ---- accounts ----
app.get('/api/accounts', requireAuth, (req, res) => sendJSON(req, res, computeAccounts(req.userData)));

app.post('/api/accounts', requireAuth, ah(async (req, res) => {
  const { name, type, openingBalance, color, icon, currency, institution } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  if (!assertUnderLimit(req, res, 'accounts', req.userData.accounts.length)) return;
  const acc = await db.insertAccount(req.userId, { name, type: type || 'bank', openingBalance: numOr(openingBalance), color: color || '#6366f1', icon: icon || 'Landmark', currency: currency || 'INR', institution: institution || '' });
  req.userData.accounts.push(acc);
  bumpCache(req.userId);
  res.status(201).json(computeAccounts(req.userData).find((a) => a.id === acc.id));
}));

app.patch('/api/accounts/:id', requireAuth, ah(async (req, res) => {
  const acc = req.userData.accounts.find((a) => a.id === req.params.id);
  if (!acc) return res.status(404).json({ error: 'not found' });
  const patch = {};
  ['name', 'type', 'openingBalance', 'color', 'icon', 'currency', 'institution'].forEach((f) => {
    if (req.body[f] !== undefined) patch[f] = f === 'openingBalance' ? Number(req.body[f]) : req.body[f];
  });
  Object.assign(acc, patch);
  if (Object.keys(patch).length) await db.updateAccount(req.userId, acc.id, patch);
  bumpCache(req.userId);
  res.json(computeAccounts(req.userData).find((a) => a.id === acc.id));
}));

app.delete('/api/accounts/:id', requireAuth, ah(async (req, res) => {
  const { id } = req.params;
  const inUse =
    req.userData.transactions.some((t) => t.accountId === id || t.fromAccountId === id || t.toAccountId === id) ||
    req.userData.bills.some((b) => b.accountId === id || b.fromAccountId === id || b.toAccountId === id) ||
    req.userData.goals.some((g) => g.accountId === id);
  if (inUse) return res.status(409).json({ error: 'in_use' });
  await db.deleteAccount(req.userId, id);
  req.userData.accounts = req.userData.accounts.filter((a) => a.id !== id);
  bumpCache(req.userId);
  res.json({ ok: true });
}));

// ---- transactions ----
// `categories` is this user's own category list — needed so a transfer's
// categoryId can be resolved server-side to the real 'Transfer' category
// (a Postgres uuid, seeded for every user by 0001_init.sql's signup
// trigger) rather than trusting whatever the client sends. The frontend
// used to hardcode the literal string 'cat_transfer' here, a leftover from
// the pre-Postgres backend where category ids were fixed strings — sending
// that non-uuid string crashed every transfer with a 500 ('invalid input
// syntax for type uuid'). Non-transfer categoryId still goes through
// emptyToNull so a cleared "— None —" selection can't hit the same crash.
function buildTransactionFromBody(body, existing, categories = []) {
  const type = body.type || existing?.type || 'expense';
  const amount = signAmount(type, body.amount !== undefined ? body.amount : existing?.amount);
  const categoryId = type === 'transfer'
    ? categoryIdByName(categories, 'Transfer')
    : emptyToNull(body.categoryId !== undefined ? body.categoryId : existing?.categoryId || null);
  const txn = {
    id: existing?.id,
    date: body.date || existing?.date || iso(new Date()),
    vendor: body.vendor !== undefined ? body.vendor : existing?.vendor || '',
    categoryId,
    amount,
    type,
    paymentMethod: body.paymentMethod !== undefined ? body.paymentMethod : existing?.paymentMethod || '',
    note: body.note !== undefined ? body.note : existing?.note || '',
    labels: body.labels !== undefined ? body.labels : existing?.labels || [],
  };
  if (body.payer !== undefined || existing?.payer !== undefined) txn.payer = body.payer !== undefined ? body.payer : existing?.payer;
  if (body.paymentStatus !== undefined || existing?.paymentStatus !== undefined) txn.paymentStatus = body.paymentStatus !== undefined ? body.paymentStatus : existing?.paymentStatus;
  if (body.currency !== undefined || existing?.currency !== undefined) txn.currency = body.currency !== undefined ? body.currency : existing?.currency;
  if (existing?.sourceBillId) txn.sourceBillId = existing.sourceBillId;
  if (type === 'transfer') {
    txn.fromAccountId = body.fromAccountId !== undefined ? body.fromAccountId : existing?.fromAccountId;
    txn.toAccountId = body.toAccountId !== undefined ? body.toAccountId : existing?.toAccountId;
  } else {
    txn.accountId = body.accountId !== undefined ? body.accountId : existing?.accountId;
  }
  return txn;
}

app.get('/api/transactions', requireAuth, (req, res) => {
  const {
    type, category, q, accountId,
    dateFrom, dateTo, amountMin, amountMax, label, goalId, sourceBillId, paymentMethod,
  } = req.query;
  let list = req.userData.transactions;
  if (type) list = list.filter((t) => t.type === type);
  if (category) list = list.filter((t) => t.categoryId === category);
  if (accountId) list = list.filter((t) => t.accountId === accountId || t.fromAccountId === accountId || t.toAccountId === accountId);
  if (q) {
    const needle = String(q).toLowerCase();
    const catName = (id) => req.userData.categories.find((c) => c.id === id)?.name || '';
    const accName = (id) => req.userData.accounts.find((a) => a.id === id)?.name || '';
    list = list.filter((t) =>
      [t.vendor, t.note, catName(t.categoryId), t.payer, t.paymentMethod, accName(t.accountId), accName(t.fromAccountId), accName(t.toAccountId), ...(t.labels || [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }
  // Additive search/filter params — all optional, omitting them reproduces
  // the exact behavior above unchanged.
  if (dateFrom) list = list.filter((t) => t.date >= dateFrom);
  if (dateTo) list = list.filter((t) => t.date <= dateTo);
  if (amountMin !== undefined) list = list.filter((t) => Math.abs(t.amount) >= Number(amountMin));
  if (amountMax !== undefined) list = list.filter((t) => Math.abs(t.amount) <= Number(amountMax));
  if (label) list = list.filter((t) => (t.labels || []).some((l) => String(l).toLowerCase() === String(label).toLowerCase()));
  if (goalId) list = list.filter((t) => t.goalId === goalId);
  if (sourceBillId) list = list.filter((t) => t.sourceBillId === sourceBillId);
  if (paymentMethod) list = list.filter((t) => (t.paymentMethod || '').toLowerCase() === String(paymentMethod).toLowerCase());
  sendJSON(req, res, sortTransactionsRecentFirst(list));
});

const ACCOUNT_FIELDS = ['accountId', 'fromAccountId', 'toAccountId'];
// uuid-typed FK columns across every PATCH payload builder that needs the
// empty-string-to-null coercion (see emptyToNull above) — a superset is safe
// since each call site only ever checks membership for the fields it patches.
const UUID_FK_FIELDS = new Set(['categoryId', 'accountId', 'fromAccountId', 'toAccountId']);

app.post('/api/transactions', requireAuth, ah(async (req, res) => {
  const body = { ...(req.body || {}) };
  if (!body.accountId && !body.fromAccountId && (body.type || 'expense') !== 'transfer' && req.userData.accounts[0]) {
    body.accountId = req.userData.accounts[0].id;
  }
  const badField = foreignAccountField(req.userData, body, ACCOUNT_FIELDS);
  if (badField) return res.status(400).json({ error: `${badField} must reference one of your own accounts` });
  if (!assertUnderLimit(req, res, 'transactions', req.userData.transactions.length)) return;
  const txn = await db.insertTransaction(req.userId, buildTransactionFromBody(body, undefined, req.userData.categories));
  req.userData.transactions.push(txn);
  bumpCache(req.userId);
  res.status(201).json(txn);
}));

app.patch('/api/transactions/:id', requireAuth, ah(async (req, res) => {
  const idx = req.userData.transactions.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  const existing = req.userData.transactions[idx];
  const body = req.body || {};
  const badField = foreignAccountField(req.userData, body, ACCOUNT_FIELDS);
  if (badField) return res.status(400).json({ error: `${badField} must reference one of your own accounts` });
  const updated = buildTransactionFromBody(body, existing, req.userData.categories);
  // A contribution's link to its goal isn't exposed in the generic edit UI
  // (NewTransactionModal never sends goalId), so it's preserved by default
  // using the same "absent key keeps the existing value" idiom every other
  // field above already follows.
  updated.goalId = body.goalId !== undefined ? body.goalId : existing.goalId;
  // buildTransactionFromBody rebuilds the whole record and only carries the
  // account-reference key(s) that apply to the (possibly new) type — e.g. a
  // transfer only has fromAccountId/toAccountId, no accountId key at all.
  // The in-memory replace below reproduces that cleanly (whole-object
  // replace), but a SQL UPDATE only touches columns present in the patch, so
  // switching a transaction's type would otherwise leave a stale
  // account_id/from_account_id/to_account_id behind in Postgres. Explicitly
  // null out whichever side doesn't apply so the DB row matches the
  // in-memory/response shape's intent exactly.
  const dbPatch = { ...updated, accountId: updated.accountId ?? null, fromAccountId: updated.fromAccountId ?? null, toAccountId: updated.toAccountId ?? null, goalId: updated.goalId ?? null };
  await db.updateTransaction(req.userId, req.params.id, dbPatch);
  req.userData.transactions[idx] = updated;

  // Keep a linked goal's `saved` synchronized with this edit — a delta
  // against the transaction's amount *before* this edit (`existing`), not a
  // full recompute (see applyGoalSavedDelta). If the goal link itself
  // changed, move the full amount off the old goal and onto the new one.
  if (existing.goalId && updated.goalId && existing.goalId === updated.goalId) {
    await applyGoalSavedDelta(req, updated.goalId, updated.amount - existing.amount);
  } else {
    if (existing.goalId) await applyGoalSavedDelta(req, existing.goalId, -existing.amount);
    if (updated.goalId) await applyGoalSavedDelta(req, updated.goalId, updated.amount);
  }

  bumpCache(req.userId);
  res.json(updated);
}));

app.post('/api/transactions/bulk', requireAuth, ah(async (req, res) => {
  const rows = (req.body && req.body.rows) || [];
  const badRow = rows.find((row) => foreignAccountField(req.userData, row, ACCOUNT_FIELDS));
  if (badRow) return res.status(400).json({ error: 'one or more rows reference an account that is not yours' });
  if (!assertUnderLimit(req, res, 'transactions', req.userData.transactions.length + rows.length - 1)) return;
  const created = await db.insertTransactionsBulk(req.userId, rows.map((row) => buildTransactionFromBody(row, undefined, req.userData.categories)));
  req.userData.transactions.push(...created);
  bumpCache(req.userId);
  res.status(201).json({ count: created.length, transactions: created });
}));

app.delete('/api/transactions/:id', requireAuth, ah(async (req, res) => {
  const existing = req.userData.transactions.find((t) => t.id === req.params.id);
  await db.deleteTransaction(req.userId, req.params.id);
  req.userData.transactions = req.userData.transactions.filter((t) => t.id !== req.params.id);
  if (existing?.goalId) await applyGoalSavedDelta(req, existing.goalId, -existing.amount);
  bumpCache(req.userId);
  res.json({ ok: true });
}));

// ---- budgets (fixed limit per category per period) ----
app.get('/api/budgets', requireAuth, (req, res) => {
  const { accountId } = req.query;
  const txns = accountId ? req.userData.transactions.filter((t) => t.accountId === accountId) : req.userData.transactions;
  const list = req.userData.budgets.map((b) => ({
    ...b,
    category: req.userData.categories.find((c) => c.id === b.categoryId) || null,
    spent: computeBudgetSpent(b, txns, req.userData.categories),
  }));
  sendJSON(req, res, list);
});

app.post('/api/budgets', requireAuth, ah(async (req, res) => {
  const { categoryId, limit, period, alertAt, startDate, endDate } = req.body || {};
  if (!categoryId || !limit) return res.status(400).json({ error: 'categoryId and limit are required' });
  if (!assertUnderLimit(req, res, 'budgets', req.userData.budgets.length)) return;
  const budget = await db.insertBudget(req.userId, { categoryId, limit: Number(limit), period: period || 'monthly', alertAt: alertAt !== undefined ? Number(alertAt) : 80, startDate: startDate || null, endDate: endDate || null });
  req.userData.budgets.push(budget);
  bumpCache(req.userId);
  res.status(201).json(budget);
}));

app.patch('/api/budgets/:id', requireAuth, ah(async (req, res) => {
  const b = req.userData.budgets.find((x) => x.id === req.params.id);
  if (!b) return res.status(404).json({ error: 'not found' });
  const patch = {};
  ['categoryId', 'limit', 'period', 'alertAt', 'startDate', 'endDate'].forEach((f) => {
    if (req.body[f] !== undefined) patch[f] = f === 'limit' || f === 'alertAt' ? Number(req.body[f]) : req.body[f];
  });
  Object.assign(b, patch);
  if (Object.keys(patch).length) await db.updateBudget(req.userId, b.id, patch);
  bumpCache(req.userId);
  res.json(b);
}));

app.delete('/api/budgets/:id', requireAuth, ah(async (req, res) => {
  await db.deleteBudget(req.userId, req.params.id);
  req.userData.budgets = req.userData.budgets.filter((b) => b.id !== req.params.id);
  bumpCache(req.userId);
  res.json({ ok: true });
}));

// ---- bills (recurring & bills) ----
app.get('/api/bills', requireAuth, (req, res) => {
  const { q } = req.query;
  let list = req.userData.bills;
  if (q) {
    const needle = String(q).toLowerCase();
    list = list.filter((b) => [b.name, b.vendor, b.category].filter(Boolean).join(' ').toLowerCase().includes(needle));
  }
  sendJSON(req, res, list);
});

app.post('/api/bills', requireAuth, ah(async (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.amount || !b.dueDate) return res.status(400).json({ error: 'name, amount and dueDate are required' });
  if (!isValidDateStr(b.dueDate)) return res.status(400).json({ error: 'dueDate must be a valid date' });
  const type = b.type || 'expense';
  if (type === 'transfer') {
    if (!b.fromAccountId || !b.toAccountId) return res.status(400).json({ error: 'Transfers need both a from and to account.' });
    if (b.fromAccountId === b.toAccountId) return res.status(400).json({ error: 'From and to accounts must be different.' });
  } else if (b.autoPost && !b.categoryId) {
    return res.status(400).json({ error: 'Auto-post bills need a category so we know how to book the transaction.' });
  }
  const badField = foreignAccountField(req.userData, b, ACCOUNT_FIELDS);
  if (badField) return res.status(400).json({ error: `${badField} must reference one of your own accounts` });
  const frequency = b.frequency || 'monthly';
  const dueDate = (b.autoPost && frequency !== 'one-time') ? nextFutureDueDate(b.dueDate, frequency) : b.dueDate;
  const bill = await db.insertBill(req.userId, {
    name: b.name, type, amount: Number(b.amount),
    dueDate, frequency, status: b.status || 'pending',
    category: b.category || '', categoryId: type === 'transfer' ? categoryIdByName(req.userData.categories, 'Transfer') : b.categoryId || null, vendor: b.vendor || '',
    paymentMethod: b.paymentMethod || '', note: b.note || '', labels: Array.isArray(b.labels) ? b.labels : [],
    autoPost: !!b.autoPost, autopay: !!b.autopay,
    active: b.active !== undefined ? !!b.active : true,
    ...(type === 'transfer'
      ? { fromAccountId: b.fromAccountId, toAccountId: b.toAccountId }
      : { accountId: b.accountId || (req.userData.accounts[0] && req.userData.accounts[0].id) }),
  });
  req.userData.bills.push(bill);
  bumpCache(req.userId);
  res.status(201).json(bill);
}));

app.patch('/api/bills/:id', requireAuth, ah(async (req, res) => {
  const bill = req.userData.bills.find((x) => x.id === req.params.id);
  if (!bill) return res.status(404).json({ error: 'not found' });
  const body = req.body || {};
  if (body.dueDate !== undefined && !isValidDateStr(body.dueDate)) {
    return res.status(400).json({ error: 'dueDate must be a valid date' });
  }
  const nextType = body.type !== undefined ? body.type : bill.type;
  const nextAutoPost = body.autoPost !== undefined ? !!body.autoPost : bill.autoPost;
  const nextCategoryId = body.categoryId !== undefined ? body.categoryId : bill.categoryId;
  const nextFromAccountId = body.fromAccountId !== undefined ? body.fromAccountId : bill.fromAccountId;
  const nextToAccountId = body.toAccountId !== undefined ? body.toAccountId : bill.toAccountId;
  if (nextType === 'transfer') {
    if (!nextFromAccountId || !nextToAccountId) return res.status(400).json({ error: 'Transfers need both a from and to account.' });
    if (nextFromAccountId === nextToAccountId) return res.status(400).json({ error: 'From and to accounts must be different.' });
  } else if (nextAutoPost && !nextCategoryId) {
    return res.status(400).json({ error: 'Auto-post bills need a category so we know how to book the transaction.' });
  }
  const badField = foreignAccountField(req.userData, body, ACCOUNT_FIELDS);
  if (badField) return res.status(400).json({ error: `${badField} must reference one of your own accounts` });
  const wasPending = bill.status === 'pending';
  const patch = {};
  ['name', 'type', 'amount', 'dueDate', 'frequency', 'status', 'category', 'categoryId', 'vendor', 'paymentMethod', 'note', 'labels', 'autoPost', 'autopay', 'active', 'accountId', 'fromAccountId', 'toAccountId'].forEach((f) => {
    if (body[f] !== undefined) {
      let value = body[f];
      if (f === 'amount') value = Number(value);
      else if (UUID_FK_FIELDS.has(f)) value = emptyToNull(value);
      patch[f] = value;
      bill[f] = value;
    }
  });
  if (nextType === 'transfer') {
    const transferCategoryId = categoryIdByName(req.userData.categories, 'Transfer');
    bill.categoryId = transferCategoryId;
    patch.categoryId = transferCategoryId;
  }
  // Auto-post must only ever affect future occurrences (never backfill past
  // due dates) — see nextFutureDueDate's comment. Applies whether autoPost
  // is being turned on right now or was already on and dueDate/frequency
  // just changed underneath it.
  const nextFrequency = body.frequency !== undefined ? body.frequency : bill.frequency;
  if (nextAutoPost && nextFrequency !== 'one-time') {
    const rolled = nextFutureDueDate(bill.dueDate, nextFrequency);
    if (rolled !== bill.dueDate) {
      bill.dueDate = rolled;
      patch.dueDate = rolled;
    }
  }
  // Reminder-only bills (autoPost off) don't get an automatic ledger post from
  // the catch-up engine, so marking one paid here books the transaction itself,
  // then rolls it to the next due date (or closes it out if one-time).
  let postedTxn = null;
  if (body.status === 'paid' && wasPending && !bill.autoPost) {
    // Captured before advanceDate mutates bill.dueDate below — see
    // 0007_bill_payments.sql's comment on why this can't be reconstructed
    // after the fact from the bill's (now-rolled-forward) current due date.
    const dueDateAtPayment = bill.dueDate;
    postedTxn = await db.insertTransaction(req.userId, buildBillTransaction(bill, { note: bill.note || '', extraLabels: ['bill-payment'] }));
    req.userData.transactions.push(postedTxn);
    const paidDate = iso(new Date());
    if (bill.frequency === 'one-time') {
      bill.active = false;
      patch.active = false;
    } else {
      bill.dueDate = advanceDate(bill.dueDate, bill.frequency);
      bill.status = 'pending';
      patch.dueDate = bill.dueDate;
      patch.status = 'pending';
    }
    bill.lastRun = new Date().toISOString();
    patch.lastRun = bill.lastRun;
    const paymentLog = await db.insertBillPayment(req.userId, {
      billId: bill.id, transactionId: postedTxn.id,
      dueDateAtPayment, paidDate, wasLate: paidDate > dueDateAtPayment,
    });
    req.userData.billPayments.push(paymentLog);
  }
  if (Object.keys(patch).length) await db.updateBill(req.userId, bill.id, patch);
  bumpCache(req.userId);
  res.json(postedTxn ? { ...bill, postedTransaction: postedTxn } : bill);
}));

app.post('/api/bills/:id/run', requireAuth, ah(async (req, res) => {
  const bill = req.userData.bills.find((x) => x.id === req.params.id);
  if (!bill) return res.status(404).json({ error: 'not found' });
  if (!bill.autoPost) return res.status(400).json({ error: 'bill is not set to auto-post' });
  if (!isValidDateStr(bill.dueDate)) return res.status(400).json({ error: 'this bill has an invalid dueDate — edit it before running' });
  const txn = await postBillTransaction(req.userId, req.userData, bill);
  bumpCache(req.userId);
  res.json({ bill, transaction: txn });
}));

app.delete('/api/bills/:id', requireAuth, ah(async (req, res) => {
  await db.deleteBill(req.userId, req.params.id);
  req.userData.bills = req.userData.bills.filter((b) => b.id !== req.params.id);
  bumpCache(req.userId);
  res.json({ ok: true });
}));

// ---- goals ----
// Keeps a linked goal's `saved` in sync when its contribution transaction is
// edited or deleted. Applies a delta, never a full recompute — `saved` can
// also be set directly and independently via the goal form's "Saved so far"
// field (see GoalModal / validateGoal's own `saved <= target` check), so
// recomputing from a sum of linked transactions would silently discard that
// manually-entered base.
async function applyGoalSavedDelta(req, goalId, delta) {
  const goal = req.userData.goals.find((g) => g.id === goalId);
  if (!goal) return;
  goal.saved = Math.min(goal.target, Math.max(0, goal.saved + delta));
  await db.updateGoal(req.userId, goal.id, { saved: goal.saved });
}

function validateGoal(body, existing) {
  const name = body.name !== undefined ? body.name : existing?.name;
  const target = body.target !== undefined ? Number(body.target) : existing?.target;
  const saved = body.saved !== undefined ? Number(body.saved) : existing?.saved || 0;
  if (!name) return 'name is required';
  if (!(target > 0)) return 'target must be greater than 0';
  if (saved > target) return 'saved cannot exceed target';
  return null;
}

app.get('/api/goals', requireAuth, (req, res) => {
  const { q } = req.query;
  let list = req.userData.goals;
  if (q) {
    const needle = String(q).toLowerCase();
    list = list.filter((g) => (g.name || '').toLowerCase().includes(needle));
  }
  sendJSON(req, res, list);
});

app.post('/api/goals', requireAuth, ah(async (req, res) => {
  const err = validateGoal(req.body || {});
  if (err) return res.status(400).json({ error: err });
  const b = req.body;
  if (!ownsAccount(req.userData, b.accountId)) return res.status(400).json({ error: 'accountId must reference one of your own accounts' });
  if (!assertUnderLimit(req, res, 'goals', req.userData.goals.length)) return;
  const goal = await db.insertGoal(req.userId, {
    name: b.name, icon: b.icon || 'Target', target: Number(b.target),
    saved: numOr(b.saved), deadline: b.deadline || null, priority: b.priority || 'medium',
    color: b.color || '#6366f1', monthlyContribution: numOr(b.monthlyContribution),
    note: b.note || '', accountId: b.accountId || null,
  });
  req.userData.goals.push(goal);
  bumpCache(req.userId);
  res.status(201).json(goal);
}));

app.patch('/api/goals/:id', requireAuth, ah(async (req, res) => {
  const goal = req.userData.goals.find((g) => g.id === req.params.id);
  if (!goal) return res.status(404).json({ error: 'not found' });
  const err = validateGoal(req.body || {}, goal);
  if (err) return res.status(400).json({ error: err });
  if (!ownsAccount(req.userData, req.body?.accountId)) return res.status(400).json({ error: 'accountId must reference one of your own accounts' });
  const patch = {};
  ['name', 'icon', 'target', 'saved', 'deadline', 'priority', 'color', 'monthlyContribution', 'note', 'accountId'].forEach((f) => {
    if (req.body[f] !== undefined) patch[f] = ['target', 'saved', 'monthlyContribution'].includes(f) ? Number(req.body[f]) : req.body[f];
  });
  Object.assign(goal, patch);
  if (Object.keys(patch).length) await db.updateGoal(req.userId, goal.id, patch);
  bumpCache(req.userId);
  res.json(goal);
}));

app.delete('/api/goals/:id', requireAuth, ah(async (req, res) => {
  await db.deleteGoal(req.userId, req.params.id);
  req.userData.goals = req.userData.goals.filter((g) => g.id !== req.params.id);
  bumpCache(req.userId);
  res.json({ ok: true });
}));

app.post('/api/goals/:id/contribute', requireAuth, ah(async (req, res) => {
  const goal = req.userData.goals.find((g) => g.id === req.params.id);
  if (!goal) return res.status(404).json({ error: 'not found' });
  const amount = numOr(req.body?.amount);
  if (amount <= 0) return res.status(400).json({ error: 'amount must be greater than 0' });
  const fromAccountId = req.body?.fromAccountId;
  const toAccountId = req.body?.toAccountId;
  if (!fromAccountId || !ownsAccount(req.userData, fromAccountId)) {
    return res.status(400).json({ error: 'fromAccountId must reference one of your own accounts' });
  }
  if (!toAccountId || !ownsAccount(req.userData, toAccountId)) {
    return res.status(400).json({ error: 'toAccountId must reference one of your own accounts' });
  }
  if (fromAccountId === toAccountId) {
    return res.status(400).json({ error: 'fromAccountId and toAccountId must be different' });
  }
  const labels = Array.isArray(req.body?.labels) ? req.body.labels : [];
  if (labels.length === 0) return res.status(400).json({ error: 'Select at least one tag or add a label.' });
  // `date` may arrive as a full datetime-local string ("2026-07-11T14:30")
  // from the frontend's Date & time field — the transactions.date column is
  // a plain date, so only the date portion is kept (mirrors how
  // NewTransactionModal's own payload slices form.datetime the same way).
  const rawDate = req.body?.date;
  const date = rawDate && isValidDateStr(rawDate) ? String(rawDate).slice(0, 10) : iso(new Date());
  const note = req.body?.note !== undefined && String(req.body.note).trim() ? String(req.body.note).trim() : `Goal contribution · ${goal.name}`;

  // A goal contribution is a real two-sided transfer, same as any other
  // transfer in the app — money leaves fromAccountId and lands in
  // toAccountId, so computeAccounts' ledger debits/credits both sides for
  // free. `goalId` links it back to the goal (for filtering + edit/delete
  // sync below), and the category is always the system 'Transfer' category,
  // never user-chosen, exactly like every other transfer.
  const txn = await db.insertTransaction(req.userId, {
    date, vendor: goal.name, categoryId: categoryIdByName(req.userData.categories, 'Transfer'),
    amount: Math.abs(amount), type: 'transfer',
    paymentMethod: '', note,
    labels: [...new Set([...labels, 'goal-contribution'])],
    fromAccountId, toAccountId, goalId: goal.id,
  });
  req.userData.transactions.push(txn);
  goal.saved = Math.min(goal.target, Math.max(0, goal.saved + amount));
  await db.updateGoal(req.userId, goal.id, { saved: goal.saved });
  bumpCache(req.userId);
  res.json({ goal, transaction: txn });
}));

// ---- debts ----
app.get('/api/debts', requireAuth, (req, res) => sendJSON(req, res, req.userData.debts));

app.post('/api/debts', requireAuth, ah(async (req, res) => {
  const b = req.body || {};
  if (!b.name || !(b.balance > 0)) return res.status(400).json({ error: 'name and balance are required' });
  const debt = await db.insertDebt(req.userId, { name: b.name, creditor: b.creditor || '', balance: Number(b.balance), apr: numOr(b.apr), minPayment: numOr(b.minPayment), dueDate: b.dueDate || null });
  req.userData.debts.push(debt);
  bumpCache(req.userId);
  res.status(201).json(debt);
}));

app.patch('/api/debts/:id', requireAuth, ah(async (req, res) => {
  const debt = req.userData.debts.find((d) => d.id === req.params.id);
  if (!debt) return res.status(404).json({ error: 'not found' });
  const patch = {};
  ['name', 'creditor', 'balance', 'apr', 'minPayment', 'dueDate'].forEach((f) => {
    if (req.body[f] !== undefined) patch[f] = ['balance', 'apr', 'minPayment'].includes(f) ? Number(req.body[f]) : req.body[f];
  });
  Object.assign(debt, patch);
  if (Object.keys(patch).length) await db.updateDebt(req.userId, debt.id, patch);
  bumpCache(req.userId);
  res.json(debt);
}));

app.delete('/api/debts/:id', requireAuth, ah(async (req, res) => {
  await db.deleteDebt(req.userId, req.params.id);
  req.userData.debts = req.userData.debts.filter((d) => d.id !== req.params.id);
  bumpCache(req.userId);
  res.json({ ok: true });
}));

app.post('/api/debts/:id/payment', requireAuth, ah(async (req, res) => {
  const debt = req.userData.debts.find((d) => d.id === req.params.id);
  if (!debt) return res.status(404).json({ error: 'not found' });
  const amount = numOr(req.body?.amount);
  if (amount <= 0) return res.status(400).json({ error: 'amount must be greater than 0' });
  const accountId = req.body?.accountId;
  if (!ownsAccount(req.userData, accountId) || !accountId) return res.status(400).json({ error: 'accountId must reference one of your own accounts' });
  const date = req.body?.date && isValidDateStr(req.body.date) ? req.body.date : iso(new Date());
  const txn = await db.insertTransaction(req.userId, {
    date,
    vendor: debt.name,
    categoryId: null,
    amount: signAmount('expense', amount),
    type: 'expense',
    paymentMethod: '',
    note: `Debt payment${debt.creditor ? ' · ' + debt.creditor : ''}`,
    labels: ['debt-payment'],
    sourceDebtId: debt.id,
    accountId,
  });
  req.userData.transactions.push(txn);
  debt.balance = Math.max(0, debt.balance - amount);
  await db.updateDebt(req.userId, debt.id, { balance: debt.balance });
  bumpCache(req.userId);
  res.json({ debt, transaction: txn });
}));

// ---- templates ----
app.get('/api/templates', requireAuth, (req, res) => sendJSON(req, res, req.userData.templates));

app.post('/api/templates', requireAuth, ah(async (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: 'name is required' });
  if (!ownsAccount(req.userData, b.accountId)) return res.status(400).json({ error: 'accountId must reference one of your own accounts' });
  const tpl = await db.insertTemplate(req.userId, { name: b.name, type: b.type || 'expense', amount: numOr(b.amount), categoryId: b.categoryId || null, accountId: b.accountId || null, paymentMethod: b.paymentMethod || '', vendor: b.vendor || '', note: b.note || '' });
  req.userData.templates.push(tpl);
  bumpCache(req.userId);
  res.status(201).json(tpl);
}));

app.patch('/api/templates/:id', requireAuth, ah(async (req, res) => {
  const tpl = req.userData.templates.find((t) => t.id === req.params.id);
  if (!tpl) return res.status(404).json({ error: 'not found' });
  if (!ownsAccount(req.userData, req.body?.accountId)) return res.status(400).json({ error: 'accountId must reference one of your own accounts' });
  const patch = {};
  ['name', 'type', 'amount', 'categoryId', 'accountId', 'paymentMethod', 'vendor', 'note'].forEach((f) => {
    if (req.body[f] === undefined) return;
    patch[f] = f === 'amount' ? Number(req.body[f]) : UUID_FK_FIELDS.has(f) ? emptyToNull(req.body[f]) : req.body[f];
  });
  Object.assign(tpl, patch);
  if (Object.keys(patch).length) await db.updateTemplate(req.userId, tpl.id, patch);
  bumpCache(req.userId);
  res.json(tpl);
}));

app.delete('/api/templates/:id', requireAuth, ah(async (req, res) => {
  await db.deleteTemplate(req.userId, req.params.id);
  req.userData.templates = req.userData.templates.filter((t) => t.id !== req.params.id);
  bumpCache(req.userId);
  res.json({ ok: true });
}));

// ---- notifications ----
// Small, separate fetch (feedback isn't part of getUserBundle/req.userData —
// it's managed via adminDb, outside the per-table db.js entity pattern).
// Excludes closed/reopened-already-actioned tickets to keep this to the
// handful of tickets that could plausibly still need the user's attention.
async function loadFeedbackNotificationTickets(userId) {
  const { rows } = await adminDb.listFeedback({ userId, pageSize: 50 });
  const relevant = rows.filter((t) => t.status !== 'closed');
  return Promise.all(relevant.map(async (t) => ({
    id: t.id, subject: t.subject, status: t.status, userLastReadAt: t.userLastReadAt,
    latestMessage: await adminDb.getLatestFeedbackMessage(t.id),
  })));
}

app.get('/api/notifications', requireAuth, ah(async (req, res) => {
  req.userData.notifications = await db.getNotificationOverlay(req.userId);
  const feedbackTickets = await loadFeedbackNotificationTickets(req.userId);
  sendJSON(req, res, generateNotificationsFor(req.userData, computeAccounts(req.userData), feedbackTickets));
}));

app.patch('/api/notifications/:id', requireAuth, ah(async (req, res) => {
  await db.upsertNotificationOverlay(req.userId, req.params.id, req.body || {});
  bumpCache(req.userId);
  res.json({ ok: true });
}));

app.post('/api/notifications/read-all', requireAuth, ah(async (req, res) => {
  req.userData.notifications = await db.getNotificationOverlay(req.userId);
  const feedbackTickets = await loadFeedbackNotificationTickets(req.userId);
  const all = generateNotificationsFor(req.userData, computeAccounts(req.userData), feedbackTickets, { includeDismissed: true });
  await db.markAllNotificationsRead(req.userId, all.map((n) => n.id));
  bumpCache(req.userId);
  res.json({ ok: true });
}));

app.delete('/api/notifications/:id', requireAuth, ah(async (req, res) => {
  await db.upsertNotificationOverlay(req.userId, req.params.id, { dismissed: true });
  bumpCache(req.userId);
  res.json({ ok: true });
}));

// ---- reports ----
app.get('/api/reports', requireAuth, requireFeature('canUseAdvancedAnalytics'), (req, res) => {
  const { transactions } = req.userData;
  const totals = transactions.reduce(
    (acc, t) => {
      if (t.type === 'income') acc.income += t.amount;
      else if (t.type === 'expense') acc.expense += Math.abs(t.amount);
      return acc;
    },
    { income: 0, expense: 0 }
  );
  const savings = totals.income - totals.expense;
  const savingsRate = totals.income > 0 ? (savings / totals.income) * 100 : 0;
  const spendingTrend = buildSpendingTrend(transactions, 7);
  const categorySpend = computeTopSpendingCategories(req.userData);
  // "Top Payees" is who you actually paid — a debt/loan repayment's vendor
  // is the debt's own name (e.g. "Personal Loan"), not a merchant, so it's
  // excluded here the same way transfers already are; it shows up in the
  // Debts page instead. Category totals above already cover "where did the
  // money go by purpose" separately from "who did it go to."
  const topVendors = computeTopMerchants(req.userData);
  sendJSON(req, res, { totals, savings, savingsRate, spendingTrend, categorySpend, topVendors });
});

// ---- AI insights (rule-based; no external calls, computed live) ----
app.get('/api/ai/insights', requireAuth, requireFeature('canUseAIInsights'), ah(async (req, res) => {
  const usedToday = await db.getAiUsageToday(req.userId);
  if (usedToday >= plans.limitFor(req.userPlan, 'aiRequestsPerDay')) {
    return res.status(403).json({ error: 'upgrade_required', limit: 'aiRequestsPerDay' });
  }
  await db.incrementAiUsage(req.userId);
  // Metering above counts the request regardless of cache outcome — a cache
  // hit still consumed the user's daily AI-request allowance, since the
  // limit is about API usage, not compute cost.
  const bundle = await insightsCache.getOrCompute(req.userId, 'ai-insights', async () => {
    const userData = req.userData;
    const accounts = computeAccounts(userData);
    const metrics = buildMetrics(userData, accounts);
    const cashFlow = computeCashFlowForecast(userData, accounts);
    const budgetPredictions = computeBudgetPredictions(userData);
    const smartSavings = computeSmartSavings(userData, accounts);
    const patterns = computeRecurringPatterns(userData.transactions, userData.categories);
    const duplicates = computeDuplicateAlerts(userData.transactions);
    const recurringVendors = new Set(patterns.map((p) => p.vendor.trim().toLowerCase()));
    const anomalies = computeAnomalies(userData.transactions, recurringVendors);
    const spendingInsights = computeSpendingInsights(userData);
    const goalInsights = computeGoalInsights(userData);
    const dailySummary = computeDailySummary(userData, accounts, metrics, smartSavings, patterns, duplicates, anomalies);
    const unusedBudgets = computeUnusedBudgets(userData);
    const largeExpenses = computeLargeExpenseAlerts(userData);
    const lowBalanceAlert = computeLowBalanceAlert(userData, accounts);
    const requiredMonthlyContribution = computeRequiredMonthlyContribution(userData);
    // Reuses the same cached 'health' entry GET /api/dashboard populates —
    // one health-score computation shared across both endpoints, not a
    // second copy.
    const health = await insightsCache.getOrCompute(req.userId, 'health', () => computeHealth(userData, accounts));
    return {
      dailySummary,
      cashFlow,
      budgetPredictions,
      smartSavings,
      subscriptions: patterns.filter((p) => p.isSubscription),
      recurring: patterns.filter((p) => !p.isSubscription),
      duplicates,
      anomalies,
      spendingInsights,
      goalInsights,
      // ---- additive fields below: Financial Insights Engine expansion ----
      weeklySummary: computeWeeklySummary(userData, accounts),
      largeExpenses,
      unusedBudgets,
      budgetAdjustments: recommendBudgetAdjustments(userData),
      yearOverYear: computeYearOverYear(userData, accounts),
      averageDailySpending: computeAverageDailySpending(userData),
      averageMonthlySavings: computeAverageMonthlySavings(userData, accounts),
      weekendVsWeekday: computeWeekendVsWeekday(userData),
      monthlyExtremes: computeMostAndLeastExpensiveMonth(userData, accounts),
      topSpendingCategories: computeTopSpendingCategories(userData, { n: 5 }),
      topMerchants: computeTopMerchants(userData),
      goalCompletionForecast: computeGoalCompletionForecast(userData),
      requiredMonthlyContribution,
      lowBalanceAlert,
      billPaymentHistory: computeBillPaymentHistory(userData),
      upcomingBills30: upcomingBills(userData, { days: 30 }),
      recommendations: buildRecommendations({
        health, budgetPredictions, unusedBudgets, spendingInsights, largeExpenses,
        smartSavings, lowBalanceAlert, goalForecasts: requiredMonthlyContribution,
      }),
    };
  });
  sendJSON(req, res, bundle);
}));

app.get('/api/ai/monthly-report', requireAuth, requireFeature('canUseAIReports'), ah(async (req, res) => {
  const usedToday = await db.getAiUsageToday(req.userId);
  if (usedToday >= plans.limitFor(req.userPlan, 'aiRequestsPerDay')) {
    return res.status(403).json({ error: 'upgrade_required', limit: 'aiRequestsPerDay' });
  }
  await db.incrementAiUsage(req.userId);
  const now = new Date();
  let [year, month] = String(req.query.month || '').split('-').map(Number);
  if (!year || !month || month < 1 || month > 12) {
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }
  const report = await insightsCache.getOrCompute(req.userId, `ai-monthly-report:${year}-${month}`, () => {
    const userData = req.userData;
    const accounts = computeAccounts(userData);
    return computeMonthlyAIReport(userData, accounts, year, month - 1);
  });
  sendJSON(req, res, report);
}));

// ---- 404 + error handling (must be last) ----
app.use((req, res) => res.status(404).json({ error: 'not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ error: 'invalid JSON body' });
  }
  console.error('[unhandled error]', err);
  res.status(500).json({ error: 'internal server error' });
});

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------
// No more boot-time auto-post sweep: the old file store loaded every user's
// data into one in-memory blob at startup, so a single pass over
// db.userData could catch up every user's bills at once. With Postgres each
// user's data is only ever fetched per-request (db.getUserBundle inside
// requireAuth), so there's no "all users" blob to sweep here — each user's
// next authenticated request runs processAutoPostBillsForUser for just
// their own data instead (see requireAuth above). Simplest option that
// matches the new per-request-scoped design.

app.listen(PORT, () => {
  console.log(`Wallet backend running on http://localhost:${PORT}`);
});
