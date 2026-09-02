// The one place that decides what an internal subscription status MEANS for
// premium access, and the canonical (provider-independent) event vocabulary
// the webhook handler switches on. Same "config owns the shape, nothing else
// compares by name" rule as plans.js / subscriptionService.js — provider
// adapters translate their own raw strings into these, and only these.

const { STATUS } = require('../subscriptionService');

// Internal subscription.status vocabulary (see 0029_subscription_billing.sql).
const SUB_STATUS = Object.freeze({
  INCOMPLETE: 'incomplete', // checkout started, first payment/mandate not confirmed
  TRIALING: 'trialing',
  ACTIVE: 'active',
  PAST_DUE: 'past_due', // a renewal charge failed; provider is retrying (grace period)
  PAUSED: 'paused',
  CANCELLED: 'cancelled', // will not renew (may still be inside a paid period)
  EXPIRED: 'expired', // fully over — no access
});

// Canonical event types the webhook handler acts on. Every provider event maps
// to exactly one of these (or is ignored).
const EVENT = Object.freeze({
  ACTIVATED: 'subscription.activated', // first payment / mandate confirmed
  UPDATED: 'subscription.updated', // status / periods / cancel flag changed
  PAYMENT_SUCCEEDED: 'payment.succeeded', // a (renewal) invoice was paid
  PAYMENT_FAILED: 'payment.failed', // a (renewal) charge failed
  CANCELLED: 'subscription.cancelled',
  COMPLETED: 'subscription.completed', // fixed-count schedule finished
  PAUSED: 'subscription.paused',
  RESUMED: 'subscription.resumed',
  TRIAL_WILL_END: 'subscription.trial_will_end',
});

// Statuses that currently grant (or are about to grant) premium access. Also
// the set the "one live subscription per user" partial unique index covers —
// keep this list and db.js's LIVE_SUBSCRIPTION_STATUSES in sync.
const LIVE_STATUSES = [
  SUB_STATUS.INCOMPLETE,
  SUB_STATUS.TRIALING,
  SUB_STATUS.ACTIVE,
  SUB_STATUS.PAST_DUE,
  SUB_STATUS.PAUSED,
];

// Does this internal status, on its own, mean the user should have premium
// right now? `past_due` DOES (the grace window) — access is only actually
// removed once the paid period end passes, which subscriptionService.
// computeStatus derives from subscriptionEndsAt. `incomplete` does NOT.
function grantsPremium(status) {
  return (
    status === SUB_STATUS.TRIALING ||
    status === SUB_STATUS.ACTIVE ||
    status === SUB_STATUS.PAST_DUE
  );
}

// Map an internal subscription row to the profiles.subscription_* mirror shape
// db.mirrorSubscriptionToProfile writes. This is what makes
// subscriptionService.computeStatus (the single source of premium truth) agree
// with the provider without ever reading the `subscriptions` table.
//
//   trialing        -> FREE_TRIAL, trial dates, ends at trial_end
//   active/past_due  -> ACTIVE, subscription window, ends at current_period_end
//                       (past_due keeps access until that end passes -> EXPIRED)
//   cancelled        -> ACTIVE until current_period_end (cancelAtPeriodEnd),
//                       then EXPIRED; if the period already passed -> CANCELLED
//   paused           -> CANCELLED (no access) until a resume event
//   expired          -> EXPIRED
//   incomplete       -> null (caller should not mirror; leave prior state)
function mirrorShapeFor(sub, now = new Date()) {
  const ref = now instanceof Date ? now : new Date(now);
  const periodEnd = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
  const stillInPaidPeriod = periodEnd ? periodEnd.getTime() > ref.getTime() : false;

  const base = {
    provider: sub.provider ?? null,
    providerCustomerId: sub.providerCustomerId ?? null,
    providerSubscriptionId: sub.providerSubscriptionId ?? null,
    billingPeriod: sub.billingCycle ?? null,
    priceAtPurchase: sub.amount ?? null,
    currency: sub.currency ?? null,
    currentPeriodStart: sub.currentPeriodStart ?? null,
    currentPeriodEnd: sub.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: !!sub.cancelAtPeriodEnd,
  };

  switch (sub.status) {
    case SUB_STATUS.INCOMPLETE:
      return null;

    case SUB_STATUS.TRIALING:
      return {
        ...base,
        subscriptionType: STATUS.FREE_TRIAL,
        trialStartedAt: sub.trialStartAt ?? sub.currentPeriodStart ?? null,
        trialEndsAt: sub.trialEndAt ?? sub.currentPeriodEnd ?? null,
        subscriptionStartedAt: null,
        subscriptionEndsAt: null,
      };

    case SUB_STATUS.ACTIVE:
    case SUB_STATUS.PAST_DUE:
      return {
        ...base,
        subscriptionType: STATUS.ACTIVE,
        subscriptionStartedAt: sub.currentPeriodStart ?? null,
        subscriptionEndsAt: sub.currentPeriodEnd ?? null,
      };

    case SUB_STATUS.CANCELLED:
      return stillInPaidPeriod
        ? {
            ...base,
            subscriptionType: STATUS.ACTIVE,
            subscriptionStartedAt: sub.currentPeriodStart ?? null,
            subscriptionEndsAt: sub.currentPeriodEnd ?? null,
            cancelAtPeriodEnd: true,
          }
        : {
            ...base,
            subscriptionType: STATUS.CANCELLED,
            subscriptionEndsAt: sub.currentPeriodEnd ?? ref.toISOString(),
          };

    case SUB_STATUS.PAUSED:
      return {
        ...base,
        subscriptionType: STATUS.CANCELLED,
        subscriptionEndsAt: sub.currentPeriodEnd ?? ref.toISOString(),
      };

    case SUB_STATUS.EXPIRED:
    default:
      return {
        ...base,
        subscriptionType: STATUS.EXPIRED,
        subscriptionEndsAt: sub.currentPeriodEnd ?? ref.toISOString(),
      };
  }
}

module.exports = { SUB_STATUS, EVENT, LIVE_STATUSES, grantsPremium, mirrorShapeFor };
