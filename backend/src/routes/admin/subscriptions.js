// Admin panel — Subscriptions module. Global free-trial settings (Super
// Admin only) + a per-user subscription list. Same route shape as rbac.js:
// ah() for async, requirePermission for reads, recordAudit after a write.
//
// There is NO per-user subscription table — a user's record lives in the
// additive profiles.subscription_* columns (0025), so the user list is just
// adminDb.listUsers() rows run through the same pure subscriptionService the
// consumer app uses.
const express = require('express');
const { supabase } = require('../../supabaseClient');
const db = require('../../db');
const adminDb = require('../../adminDb');
const subscriptionService = require('../../services/subscriptionService');
const currencyService = require('../../services/currencyService');
const { requirePermission, requireSuperAdmin } = require('../../middleware/adminAuth');
const { recordAudit } = require('../../lib/adminAudit');
const { ah } = require('../../lib/asyncHandler');

const router = express.Router();

function subShapeFromProfile(row, now) {
  return subscriptionService.toApiShape(
    {
      type: row.subscriptionType || subscriptionService.STATUS.FREE_ACCESS,
      trialStartedAt: row.trialStartedAt,
      trialEndsAt: row.trialEndsAt,
      subscriptionStartedAt: row.subscriptionStartedAt,
      subscriptionEndsAt: row.subscriptionEndsAt,
      // Recurring-billing mirror (0029) — surfaced read-only for support. Null
      // for anyone who never checked out through a provider.
      provider: row.subscriptionProvider,
      billingCycle: row.subscriptionBillingPeriod,
      currentPeriodStart: row.subscriptionCurrentPeriodStart,
      currentPeriodEnd: row.subscriptionCurrentPeriodEnd,
      cancelAtPeriodEnd: row.subscriptionCancelAtPeriodEnd,
      nextBillingDate: row.subscriptionCancelAtPeriodEnd ? null : row.subscriptionCurrentPeriodEnd,
    },
    now
  );
}

router.get('/settings', requirePermission('subscriptions', 'view'), ah(async (req, res) => {
  res.json(await db.getSubscriptionSettings());
}));

// Super-Admin-only. `trialEnabled` false->true stamps enforcement_started_at
// once (db.updateSubscriptionSettings) — the grandfather cutoff.
router.put('/settings', requireSuperAdmin, ah(async (req, res) => {
  const body = req.body || {};
  const patch = {};
  if (body.trialEnabled !== undefined) {
    if (typeof body.trialEnabled !== 'boolean') {
      return res.status(400).json({ error: 'trialEnabled must be a boolean' });
    }
    patch.trialEnabled = body.trialEnabled;
  }
  if (body.trialDurationMonths !== undefined) {
    const n = Number(body.trialDurationMonths);
    if (!Number.isInteger(n) || n < 1 || n > 12) {
      return res.status(400).json({ error: 'trialDurationMonths must be an integer 1-12' });
    }
    patch.trialDurationMonths = n;
  }
  if (body.enforcementEnabled !== undefined) {
    if (typeof body.enforcementEnabled !== 'boolean') {
      return res.status(400).json({ error: 'enforcementEnabled must be a boolean' });
    }
    patch.enforcementEnabled = body.enforcementEnabled;
  }
  if (body.defaultCurrency !== undefined) {
    if (!/^[A-Za-z]{3}$/.test(String(body.defaultCurrency))) {
      return res.status(400).json({ error: 'defaultCurrency must be a 3-letter code' });
    }
    patch.defaultCurrency = String(body.defaultCurrency).toUpperCase();
  }
  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: 'nothing to update' });
  }

  const before = await db.getSubscriptionSettings();
  let after;
  try {
    after = await db.updateSubscriptionSettings(patch, req.admin.id);
  } catch (err) {
    if (err.code === 'DEFAULT_CURRENCY_NOT_PRICED') {
      return res.status(400).json({ error: 'default_currency_not_priced' });
    }
    throw err;
  }
  await recordAudit({
    req,
    action: 'subscription.settings.update',
    targetType: 'subscription_settings',
    targetId: null,
    before,
    after,
  });
  res.json(after);
}));

// Per-user list — reuses adminDb.listUsers()'s pagination/search, then
// derives each row's live status. Paginated so the first page never pulls
// the whole table.
router.get('/users', requirePermission('subscriptions', 'view'), ah(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 25));
  const { rows, total } = await adminDb.listUsers({
    page,
    pageSize,
    search: req.query.search || '',
  });
  const now = new Date();
  res.json({
    rows: rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      memberSince: row.memberSince,
      subscription: subShapeFromProfile(row, now),
    })),
    total,
    page,
    pageSize,
  });
}));

// Small header summary — counts by derived status. Single columnar select +
// JS aggregation, same pattern (and same "replace with a view if profiles
// grows huge" caveat) as dashboard.js.
router.get('/overview', requirePermission('subscriptions', 'view'), ah(async (req, res) => {
  const settings = await db.getSubscriptionSettings();
  const { data, error } = await supabase
    .from('profiles')
    .select('subscription_type, trial_ends_at, subscription_ends_at');
  if (error) throw error;

  const now = new Date();
  const counts = {
    [subscriptionService.STATUS.FREE_ACCESS]: 0,
    [subscriptionService.STATUS.FREE_TRIAL]: 0,
    [subscriptionService.STATUS.ACTIVE]: 0,
    [subscriptionService.STATUS.EXPIRED]: 0,
    [subscriptionService.STATUS.CANCELLED]: 0,
  };
  let unresolved = 0;
  for (const row of data || []) {
    if (!row.subscription_type) {
      unresolved += 1;
      continue;
    }
    const status = subscriptionService.computeStatus(
      {
        type: row.subscription_type,
        trialEndsAt: row.trial_ends_at,
        subscriptionEndsAt: row.subscription_ends_at,
      },
      now
    );
    counts[status] = (counts[status] || 0) + 1;
  }

  res.json({
    trialEnabled: settings.trialEnabled,
    trialDurationMonths: settings.trialDurationMonths,
    enforcementStartedAt: settings.enforcementStartedAt,
    counts,
    // Accounts that haven't hit an authenticated request since 0025 — they'll
    // resolve to FREE_ACCESS or FREE_TRIAL on their next /api/me.
    unresolved,
  });
}));

// ---- pricing (admin-configured per-currency; no FX conversion) ----

const NOT_MIGRATED_MSG =
  'Subscription pricing tables are not set up yet. Apply the 0026_subscription_pricing.sql migration in Supabase, then reload.';

router.get('/prices', requirePermission('subscriptions', 'view'), ah(async (req, res) => {
  const [migrated, rows, settings] = await Promise.all([
    db.subscriptionPricingMigrated(),
    db.getSubscriptionPrices(),
    db.getSubscriptionSettings(),
  ]);
  const configured = new Set(rows.map((r) => r.currency));
  const addable = Object.keys(currencyService.CURRENCY_META)
    .filter((code) => !configured.has(code))
    .map((code) => ({ code, name: currencyService.currencyMeta(code).name, symbol: currencyService.currencyMeta(code).symbol }));
  res.json({ migrated, rows, defaultCurrency: settings.defaultCurrency, addable });
}));

router.put('/prices/:currency', requireSuperAdmin, ah(async (req, res) => {
  const currency = String(req.params.currency || '').toUpperCase();
  if (!currencyService.CURRENCY_META[currency]) {
    return res.status(400).json({ error: 'unsupported_currency' });
  }
  const {
    monthlyPrice, yearlyPrice, enabled,
    stripePriceMonthly, stripePriceYearly, razorpayPlanMonthly, razorpayPlanYearly,
  } = req.body || {};
  for (const [k, v] of [['monthlyPrice', monthlyPrice], ['yearlyPrice', yearlyPrice]]) {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: `${k} must be a number >= 0` });
  }
  if (enabled !== undefined && typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled must be a boolean' });
  }
  // Provider plan/price ids (0029). '' clears; a non-empty value must look
  // like an id string. undefined leaves the stored value alone.
  for (const [k, v] of [
    ['stripePriceMonthly', stripePriceMonthly], ['stripePriceYearly', stripePriceYearly],
    ['razorpayPlanMonthly', razorpayPlanMonthly], ['razorpayPlanYearly', razorpayPlanYearly],
  ]) {
    if (v !== undefined && v !== null && typeof v !== 'string') {
      return res.status(400).json({ error: `${k} must be a string` });
    }
    if (typeof v === 'string' && v.length > 120) {
      return res.status(400).json({ error: `${k} is too long` });
    }
  }

  let existing = null;
  let after;
  try {
    existing = (await db.getSubscriptionPrices()).find((p) => p.currency === currency) || null;
    after = await db.upsertSubscriptionPrice(
      currency,
      { monthlyPrice, yearlyPrice, enabled, stripePriceMonthly, stripePriceYearly, razorpayPlanMonthly, razorpayPlanYearly },
      req.admin.id
    );
  } catch (err) {
    if (err.code === 'PRICING_NOT_MIGRATED') return res.status(409).json({ error: 'pricing_not_migrated', message: NOT_MIGRATED_MSG });
    throw err;
  }
  await recordAudit({
    req,
    action: 'subscription.price.update',
    targetType: 'subscription_price',
    targetId: null,
    before: { currency, ...(existing || {}) },
    after,
  });
  res.json(after);
}));

router.delete('/prices/:currency', requireSuperAdmin, ah(async (req, res) => {
  const currency = String(req.params.currency || '').toUpperCase();
  const [rows, settings] = await Promise.all([db.getSubscriptionPrices(), db.getSubscriptionSettings()]);
  const existing = rows.find((p) => p.currency === currency);
  if (!existing) return res.status(404).json({ error: 'not_found' });
  if (currency === settings.defaultCurrency) {
    return res.status(400).json({ error: 'cannot_delete_default_currency' });
  }
  if (rows.filter((p) => p.enabled).length <= 1 && existing.enabled) {
    return res.status(400).json({ error: 'cannot_delete_last_enabled_currency' });
  }
  try {
    await db.deleteSubscriptionPrice(currency);
  } catch (err) {
    if (err.code === 'PRICING_NOT_MIGRATED') return res.status(409).json({ error: 'pricing_not_migrated', message: NOT_MIGRATED_MSG });
    throw err;
  }
  await recordAudit({
    req,
    action: 'subscription.price.delete',
    targetType: 'subscription_price',
    targetId: null,
    before: { currency, ...existing },
    after: null,
  });
  res.status(204).end();
}));

module.exports = router;
