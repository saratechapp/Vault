// Pure subscription/free-trial logic — single source of truth for how a
// user's subscription STATE is resolved and how their live STATUS is
// derived. Same "config owns the shape, nothing else compares by name"
// philosophy as plans.js. No DB access here: callers (backend/src/db.js's
// resolveForUser, the admin routes) load rows and pass them in.
//
// The stored `type` is an intent — FREE_ACCESS | FREE_TRIAL | ACTIVE |
// CANCELLED. EXPIRED is never stored; computeStatus() derives it from the
// dates every time, so a trial "expires" the instant the clock passes
// trialEndsAt with no write required (requirement: status comes from data).

const STATUS = Object.freeze({
  FREE_ACCESS: 'FREE_ACCESS',
  FREE_TRIAL: 'FREE_TRIAL',
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
});

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Calendar-month add with end-of-month clamp: Jan 31 + 1 month => Feb 28/29,
// not an overflow into March. Matches the spec's "20 Dec -> 20 Jan" model.
function addMonths(date, n) {
  const base = toDate(date);
  if (!base) return null;
  const months = Number(n) || 0;
  const d = new Date(base.getTime());
  const targetMonthDay = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const daysInTargetMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(targetMonthDay, daysInTargetMonth));
  return d;
}

// Whole days from `now` until `endDate`, floored at 0. Ceil so "22.3 days
// left" shows as "23 days left" until the final day ticks over.
function daysRemaining(endDate, now = new Date()) {
  const end = toDate(endDate);
  const ref = toDate(now) || new Date();
  if (!end) return 0;
  return Math.max(0, Math.ceil((end.getTime() - ref.getTime()) / MS_PER_DAY));
}

// Normalize whatever the settings row / defaults look like into a predictable
// shape (camelCase, real Date or null for the cutoff).
function normalizeSettings(settings = {}) {
  return {
    trialEnabled: !!settings.trialEnabled,
    trialDurationMonths: Math.min(12, Math.max(1, Number(settings.trialDurationMonths) || 1)),
    enforcementStartedAt: toDate(settings.enforcementStartedAt),
  };
}

// The subscription record a user should get the first time we resolve them
// (i.e. profiles.subscription_type is still null). Everything keys off the
// global settings row — never a hardcoded date.
function resolveInitialSubscription({ profileCreatedAt, settings, now = new Date() }) {
  const cfg = normalizeSettings(settings);
  const created = toDate(profileCreatedAt) || toDate(now) || new Date();

  // Trial system off -> everyone just has free access.
  if (!cfg.trialEnabled) {
    return { type: STATUS.FREE_ACCESS, trialStartedAt: null, trialEndsAt: null };
  }

  // Grandfathering: accounts that existed before the Super Admin switched
  // enforcement on keep free access and are never dropped into a trial.
  if (cfg.enforcementStartedAt && created.getTime() < cfg.enforcementStartedAt.getTime()) {
    return { type: STATUS.FREE_ACCESS, trialStartedAt: null, trialEndsAt: null };
  }

  // New account under an active trial system -> automatic trial from the
  // account creation date.
  return {
    type: STATUS.FREE_TRIAL,
    trialStartedAt: created,
    trialEndsAt: addMonths(created, cfg.trialDurationMonths),
  };
}

// Live status from the stored record + the clock. `sub` fields may be Dates
// or ISO strings (DB rows) — toDate handles both.
function computeStatus(sub = {}, now = new Date()) {
  const ref = toDate(now) || new Date();
  const type = sub.type || STATUS.FREE_ACCESS;

  if (type === STATUS.ACTIVE) {
    const end = toDate(sub.subscriptionEndsAt);
    return !end || end.getTime() > ref.getTime() ? STATUS.ACTIVE : STATUS.EXPIRED;
  }
  if (type === STATUS.FREE_TRIAL) {
    const end = toDate(sub.trialEndsAt);
    return end && end.getTime() > ref.getTime() ? STATUS.FREE_TRIAL : STATUS.EXPIRED;
  }
  if (type === STATUS.CANCELLED) return STATUS.CANCELLED;
  return STATUS.FREE_ACCESS;
}

function isoOrNull(value) {
  const d = toDate(value);
  return d ? d.toISOString() : null;
}

// The exact object the consumer app and admin panel consume. `daysRemaining`
// is a convenience — the frontend also recomputes it from trialEndDate so
// the countdown stays live without a refetch.
//
// The `provider*` / `currentPeriod*` / `cancelAtPeriodEnd` / `billingCycle` /
// `nextBillingDate` fields are additive (0029_subscription_billing.sql) — the
// recurring-billing mirror on the profiles row. They read back null for any
// user who has never gone through provider checkout, so every pre-billing
// caller/consumer is unaffected.
function toApiShape(sub = {}, now = new Date()) {
  const status = computeStatus(sub, now);
  const relevantEnd =
    sub.type === STATUS.ACTIVE ? sub.subscriptionEndsAt : sub.trialEndsAt;
  return {
    status,
    type: sub.type || STATUS.FREE_ACCESS,
    trialStartDate: isoOrNull(sub.trialStartedAt),
    trialEndDate: isoOrNull(sub.trialEndsAt),
    subscriptionStartDate: isoOrNull(sub.subscriptionStartedAt),
    subscriptionEndDate: isoOrNull(sub.subscriptionEndsAt),
    daysRemaining:
      status === STATUS.FREE_TRIAL || status === STATUS.ACTIVE
        ? daysRemaining(relevantEnd, now)
        : 0,
    provider: sub.provider || null,
    billingCycle: sub.billingCycle || null,
    currentPeriodStart: isoOrNull(sub.currentPeriodStart),
    currentPeriodEnd: isoOrNull(sub.currentPeriodEnd),
    nextBillingDate: isoOrNull(sub.nextBillingDate),
    cancelAtPeriodEnd: !!sub.cancelAtPeriodEnd,
  };
}

module.exports = {
  STATUS,
  addMonths,
  daysRemaining,
  normalizeSettings,
  resolveInitialSubscription,
  computeStatus,
  toApiShape,
};
