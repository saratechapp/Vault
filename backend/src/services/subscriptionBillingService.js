// Recurring billing — the orchestration layer between the consumer routes /
// webhook router and the provider adapters + db. This module is the ONLY
// writer of the `subscriptions` table and of the profiles.subscription_*
// mirror the rest of the app reads through (db.resolveForUser ->
// subscriptionService.computeStatus).
//
// Hard rules enforced here, not in the routes:
//   * The client never supplies amount / currency / plan / status. Those come
//     from the admin-configured subscription_prices row + the verified
//     provider objects only.
//   * Premium is granted/removed by mirroring the provider's subscription
//     state — never by a request body.
//   * Every webhook is idempotent (subscription_events PK = provider event id)
//     and only acted on after its signature was verified by the route.

const db = require('../db');
const subscriptionService = require('./subscriptionService');
const providers = require('./billing/providers');
const { SUB_STATUS, EVENT, grantsPremium, mirrorShapeFor } = require('./billing/canonicalStatus');
const { securityLog } = require('../lib/securityLog');
const { countryFromHeaders } = require('../lib/geoIp');

// A Stripe trial_end / Razorpay start_at must be comfortably in the future for
// the provider to accept it. If the user's existing free trial has less than
// this left, just start the paid subscription immediately.
const MIN_TRIAL_LEAD_MS = 60 * 60 * 1000; // 1 hour

class BillingError extends Error {
  constructor(code, status = 400, extra = {}) {
    super(code);
    this.code = code;
    this.httpStatus = status;
    Object.assign(this, extra);
  }
}

// --------------------------------------------------------------------------
// currency / provider resolution (reuses the exact pricing resolver the
// Subscription screen already uses, so provider routing follows the same
// currency the user is shown prices in).
// --------------------------------------------------------------------------

async function resolveContext(userId, req, { localeHint } = {}) {
  const profile = await db.getProfile(userId);
  const settings = await db.getSubscriptionSettings();
  const pricing = await db.resolvePricingForUser(profile, {
    localeHint: localeHint || (req && req.query && req.query.locale),
    ipCountry: req ? countryFromHeaders(req) : null,
    settings,
  });
  const status = await db.resolveForUser(userId, profile);
  const { name: providerName, adapter, configured } = providers.pickProvider({
    country: profile && profile.country,
    currency: pricing && pricing.currency,
  });
  return { profile, settings, pricing, status, providerName, adapter, providerConfigured: configured };
}

// What GET /api/billing/config returns — just enough for the app to init the
// right provider SDK. Publishable ids only; never a secret.
async function billingConfig(userId, req) {
  const { providerName, adapter, providerConfigured, pricing } = await resolveContext(userId, req);
  const pub = adapter ? adapter.publishableConfig() : { provider: providerName };
  return {
    provider: providerName,
    enabled: providerConfigured && !!pricing && pricing.configured,
    ...pub, // publishableKey (stripe) or keyId (razorpay)
    currency: pricing ? pricing.currency : null,
  };
}

// --------------------------------------------------------------------------
// checkout — create the provider subscription + our incomplete row
// --------------------------------------------------------------------------

function priceRowFor(pricing, currency) {
  return (pricing.currencies || []).find((c) => c.code === currency) || pricing.selected || null;
}

// The admin-configured provider plan id for this currency + cycle lives on the
// subscription_prices row (0029). db.resolvePricingForUser doesn't surface the
// provider-plan columns, so read the raw rows.
async function providerPlanId({ providerName, currency, billingCycle }) {
  const rows = await db.getSubscriptionPrices();
  const row = rows.find((r) => r.currency === currency);
  if (!row) return null;
  if (providerName === 'stripe') {
    return billingCycle === 'yearly' ? row.stripePriceYearly : row.stripePriceMonthly;
  }
  return billingCycle === 'yearly' ? row.razorpayPlanYearly : row.razorpayPlanMonthly;
}

// If the user is mid free-trial, hand the provider the remaining trial so it
// converts automatically at trial end (no double charge, no app-run job).
function trialConversionUnix(status) {
  if (!status || status.status !== subscriptionService.STATUS.FREE_TRIAL) return null;
  const end = status.trialEndDate ? Date.parse(status.trialEndDate) : NaN;
  if (Number.isNaN(end) || end - Date.now() < MIN_TRIAL_LEAD_MS) return null;
  return Math.floor(end / 1000);
}

async function startCheckout({ userId, email, billingCycle, req }) {
  if (billingCycle !== 'monthly' && billingCycle !== 'yearly') {
    throw new BillingError('invalid_billing_cycle', 400);
  }
  const ctx = await resolveContext(userId, req);
  if (!ctx.pricing || !ctx.pricing.configured) throw new BillingError('pricing_not_configured', 409);
  if (!ctx.adapter) throw new BillingError('provider_unknown', 500);
  if (!ctx.providerConfigured) throw new BillingError('provider_not_configured', 503, { provider: ctx.providerName });

  // Enforcement must be ON for real paid checkout — same gate the screen uses.
  if (!ctx.settings.enforcementEnabled) throw new BillingError('billing_not_enabled', 409);

  const currency = ctx.pricing.currency;
  const priceRow = priceRowFor(ctx.pricing, currency);
  if (!priceRow) throw new BillingError('pricing_not_configured', 409);

  const planId = await providerPlanId({ providerName: ctx.providerName, currency, billingCycle });
  if (!planId) throw new BillingError('provider_plan_not_configured', 409, { provider: ctx.providerName, currency, billingCycle });

  const amount = billingCycle === 'yearly' ? priceRow.yearly : priceRow.monthly;
  const trialUnix = trialConversionUnix(ctx.status);

  // Don't let a user stack subscriptions.
  const existing = await db.getLiveSubscriptionForUser(userId);
  if (existing && ['active', 'trialing', 'past_due'].includes(existing.status)) {
    throw new BillingError('already_subscribed', 409);
  }

  let created;
  let customerId = null;
  if (ctx.providerName === 'stripe') {
    customerId = await ctx.adapter.ensureCustomer({
      userId,
      email,
      existingCustomerId: existing && existing.providerCustomerId,
    });
    created = await ctx.adapter.createSubscription({
      userId,
      customerId,
      priceId: planId,
      billingCycle,
      trialEndUnix: trialUnix,
    });
    created.ephemeralKey = await ctx.adapter.createEphemeralKey(customerId);
  } else {
    created = await ctx.adapter.createSubscription({
      userId,
      planId,
      billingCycle,
      startAtUnix: trialUnix,
      notes: { userId },
    });
  }

  // Persist our incomplete row (server-authoritative amount/currency/cycle).
  // provider_subscription_id is the upsert key so a webhook that races ahead
  // still lands one row.
  const row = await db.upsertSubscriptionRecord({
    userId,
    provider: ctx.providerName,
    providerCustomerId: customerId,
    providerSubscriptionId: created.subscriptionId,
    planId,
    planName: billingCycle === 'yearly' ? 'Yearly' : 'Monthly',
    billingCycle,
    amount,
    currency,
    status: SUB_STATUS.INCOMPLETE,
    trialEndAt: trialUnix ? new Date(trialUnix * 1000).toISOString() : null,
    cancelAtPeriodEnd: false,
  });

  return {
    provider: ctx.providerName,
    billingCycle,
    amount,
    currency,
    subscriptionId: created.subscriptionId,
    // Stripe: for the PaymentSheet
    clientSecret: created.clientSecret || null,
    clientSecretType: created.clientSecretType || null,
    ephemeralKey: created.ephemeralKey || null,
    customerId: customerId || null,
    publishableKey: created.publishableKey || null,
    // Razorpay: for Checkout
    keyId: created.keyId || null,
    shortUrl: created.shortUrl || null,
    rowId: row && row.id,
  };
}

// --------------------------------------------------------------------------
// verify — optional fast-path the app calls right after the sheet closes, so
// the UI doesn't have to wait for the webhook round-trip. The webhook remains
// the source of truth; this just applies the same state early.
// --------------------------------------------------------------------------

async function verifyCheckout({ userId, provider, params }) {
  const adapter = providers.get(provider);
  if (!adapter) throw new BillingError('provider_unknown', 400);

  const row = await db.getLiveSubscriptionForUser(userId);
  if (!row) throw new BillingError('no_pending_subscription', 404);

  if (provider === 'razorpay') {
    const ok = adapter.verifyCheckoutSignature(params || {});
    if (!ok) {
      securityLog('billing_verify_bad_signature', { userId, provider });
      throw new BillingError('signature_invalid', 400);
    }
    if (params.razorpay_subscription_id && params.razorpay_subscription_id !== row.providerSubscriptionId) {
      throw new BillingError('subscription_mismatch', 400);
    }
  }

  // Pull the authoritative object from the provider and fold it in.
  let normalized = null;
  try {
    normalized = await adapter.fetchSubscription(row.providerSubscriptionId);
  } catch (err) {
    securityLog('billing_verify_fetch_failed', { userId, provider, reason: err.code || 'unknown' });
  }
  if (normalized) {
    await applySubscriptionState(row, normalized);
  }
  const profile = await db.getProfile(userId);
  return db.resolveForUser(userId, profile);
}

// --------------------------------------------------------------------------
// cancel / resume
// --------------------------------------------------------------------------

async function cancel({ userId }) {
  const row = await db.getLiveSubscriptionForUser(userId);
  if (!row) throw new BillingError('no_active_subscription', 404);
  if (row.cancelAtPeriodEnd) {
    const profile = await db.getProfile(userId);
    return db.resolveForUser(userId, profile); // already scheduled — no-op
  }
  const adapter = providers.get(row.provider);
  if (!adapter) throw new BillingError('provider_unknown', 500);
  const normalized = await adapter.cancelAtPeriodEnd(row.providerSubscriptionId);
  // Reflect immediately; the provider's own cancelled/updated webhook will
  // reconcile the exact end date.
  await applySubscriptionState(row, {
    ...normalized,
    // keep access to the end of the paid period
    status: row.currentPeriodEnd && Date.parse(row.currentPeriodEnd) > Date.now()
      ? SUB_STATUS.ACTIVE
      : normalized.status,
    cancelAtPeriodEnd: true,
  });
  const profile = await db.getProfile(userId);
  return db.resolveForUser(userId, profile);
}

async function resume({ userId }) {
  const row = await db.getLiveSubscriptionForUser(userId);
  if (!row) throw new BillingError('no_active_subscription', 404);
  if (row.provider === 'razorpay') throw new BillingError('resume_not_supported', 409, { provider: 'razorpay' });
  if (!row.cancelAtPeriodEnd) {
    const profile = await db.getProfile(userId);
    return db.resolveForUser(userId, profile);
  }
  const adapter = providers.get(row.provider);
  const normalized = await adapter.resume(row.providerSubscriptionId);
  await applySubscriptionState(row, { ...normalized, cancelAtPeriodEnd: false });
  const profile = await db.getProfile(userId);
  return db.resolveForUser(userId, profile);
}

// --------------------------------------------------------------------------
// webhook processing — the single write path for provider-driven state
// --------------------------------------------------------------------------

// `envelope` is what an adapter's normalizeEvent() returned (already signature
// -verified by the route). Idempotent: a replayed event id is a no-op; an
// event that errored mid-way on a previous delivery is retried.
async function processWebhookEvent(envelope) {
  const { id, provider, rawType, canonicalType, providerSubscriptionId, sub } = envelope;

  const { created, event } = await db.recordSubscriptionEvent({
    id,
    provider,
    type: rawType,
    canonicalType,
    providerSubscriptionId,
    userId: (sub && sub.userId) || null,
    payload: sub || null,
  });
  if (!created && event && event.processedAt) {
    return { handled: true, replay: true };
  }

  try {
    await routeCanonicalEvent(canonicalType, sub, providerSubscriptionId, provider);
    await db.markSubscriptionEventProcessed(id, null);
    return { handled: true };
  } catch (err) {
    await db.markSubscriptionEventProcessed(id, String(err && err.message ? err.message : err)).catch(() => {});
    throw err; // -> route returns 500 -> provider retries
  }
}

async function routeCanonicalEvent(canonicalType, sub, providerSubscriptionId, provider) {
  if (!canonicalType) return; // event we don't act on

  if (canonicalType === EVENT.TRIAL_WILL_END) {
    securityLog('billing_trial_will_end', { provider, providerSubscriptionId });
    return;
  }

  const row =
    (providerSubscriptionId && (await db.getSubscriptionByProviderId(providerSubscriptionId))) || null;

  // A webhook can legitimately beat our checkout insert. Recreate the row from
  // the event when we can identify the user (Stripe metadata / Razorpay notes).
  if (!row) {
    if (!sub || !sub.userId || !providerSubscriptionId) {
      securityLog('billing_webhook_orphan', { provider, providerSubscriptionId, canonicalType });
      return; // provider will retry; checkout row should land shortly
    }
    const seeded = await db.upsertSubscriptionRecord({
      userId: sub.userId,
      provider,
      providerSubscriptionId,
      providerCustomerId: sub.providerCustomerId || null,
      planId: sub.planId || null,
      billingCycle: sub.billingCycle || null,
      amount: sub.amount ?? null,
      currency: sub.currency || null,
      status: SUB_STATUS.INCOMPLETE,
    });
    return applySubscriptionState(seeded, deriveStateForEvent(canonicalType, seeded, sub));
  }

  return applySubscriptionState(row, deriveStateForEvent(canonicalType, row, sub));
}

// Given the current row + the event's normalized payload, compute the target
// internal state. mirrorShapeFor() then turns that into the premium mirror.
function deriveStateForEvent(canonicalType, row, sub) {
  const next = { ...sub };

  switch (canonicalType) {
    case EVENT.ACTIVATED:
    case EVENT.UPDATED:
      // Trust the provider's normalized status/periods wholesale.
      return next;

    case EVENT.PAYMENT_SUCCEEDED: {
      // Renewal (or first) charge cleared. Advance the paid window; a
      // previously past_due row is healthy again.
      const advancing = sub && (sub.currentPeriodEnd || sub.currentPeriodStart);
      return {
        ...next,
        status:
          row.status === SUB_STATUS.CANCELLED || row.status === SUB_STATUS.PAUSED
            ? row.status
            : SUB_STATUS.ACTIVE,
        currentPeriodStart: (advancing && sub.currentPeriodStart) || row.currentPeriodStart,
        currentPeriodEnd: (advancing && sub.currentPeriodEnd) || row.currentPeriodEnd,
        nextBillingDate:
          row.cancelAtPeriodEnd
            ? null
            : (advancing && sub.currentPeriodEnd) || row.nextBillingDate,
        latestInvoiceId: (sub && sub.latestInvoiceId) || row.latestInvoiceId,
        cancelAtPeriodEnd: row.cancelAtPeriodEnd,
        billingCycle: row.billingCycle,
        currency: row.currency,
        amount: row.amount,
      };
    }

    case EVENT.PAYMENT_FAILED:
      // Grace period: keep access until current_period_end passes (computeStatus
      // handles the flip to EXPIRED). Do NOT revoke here.
      return {
        ...row,
        status: SUB_STATUS.PAST_DUE,
        providerStatus: (sub && sub.providerStatus) || row.providerStatus,
        nextBillingDate: (sub && sub.nextBillingDate) || row.nextBillingDate,
      };

    case EVENT.CANCELLED: {
      const periodEnd = (sub && sub.currentPeriodEnd) || row.currentPeriodEnd;
      const stillInPeriod = periodEnd && Date.parse(periodEnd) > Date.now();
      return {
        ...row,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: true,
        status: stillInPeriod ? SUB_STATUS.CANCELLED : SUB_STATUS.EXPIRED,
        providerStatus: (sub && sub.providerStatus) || 'cancelled',
      };
    }

    case EVENT.COMPLETED:
      return { ...row, status: SUB_STATUS.EXPIRED, providerStatus: 'completed' };

    case EVENT.PAUSED:
      return { ...row, status: SUB_STATUS.PAUSED, providerStatus: (sub && sub.providerStatus) || 'paused' };

    case EVENT.RESUMED:
      return { ...row, status: SUB_STATUS.ACTIVE, cancelAtPeriodEnd: false, providerStatus: (sub && sub.providerStatus) || 'active' };

    default:
      return next;
  }
}

// Merge the derived state onto the row, write it, and mirror to the profile so
// premium truth (subscriptionService.computeStatus) tracks the provider.
async function applySubscriptionState(row, state) {
  if (!state) return row;
  const merged = {
    id: row.id,
    userId: row.userId,
    provider: row.provider,
    providerSubscriptionId: row.providerSubscriptionId,
    providerCustomerId: state.providerCustomerId ?? row.providerCustomerId,
    planId: state.planId ?? row.planId,
    planName: state.planName ?? row.planName,
    billingCycle: state.billingCycle ?? row.billingCycle,
    amount: state.amount ?? row.amount,
    currency: state.currency ?? row.currency,
    status: state.status ?? row.status,
    providerStatus: state.providerStatus ?? row.providerStatus,
    trialStartAt: state.trialStartAt ?? row.trialStartAt,
    trialEndAt: state.trialEndAt ?? row.trialEndAt,
    currentPeriodStart: state.currentPeriodStart ?? row.currentPeriodStart,
    currentPeriodEnd: state.currentPeriodEnd ?? row.currentPeriodEnd,
    nextBillingDate:
      state.nextBillingDate !== undefined ? state.nextBillingDate : row.nextBillingDate,
    cancelAtPeriodEnd:
      state.cancelAtPeriodEnd !== undefined ? !!state.cancelAtPeriodEnd : !!row.cancelAtPeriodEnd,
    latestInvoiceId: state.latestInvoiceId ?? row.latestInvoiceId,
  };

  const saved = await db.upsertSubscriptionRecord(merged);
  const effective = saved || merged;

  const mirror = mirrorShapeFor(effective, new Date());
  if (mirror) {
    await db.mirrorSubscriptionToProfile(effective.userId, mirror);
  } else if (!grantsPremium(effective.status)) {
    // incomplete and not granting — leave the pre-existing profile state
    // (auto-trial / free) untouched.
  }
  return effective;
}

module.exports = {
  BillingError,
  billingConfig,
  startCheckout,
  verifyCheckout,
  cancel,
  resume,
  processWebhookEvent,
  // exported for unit tests
  deriveStateForEvent,
  applySubscriptionState,
  trialConversionUnix,
};
