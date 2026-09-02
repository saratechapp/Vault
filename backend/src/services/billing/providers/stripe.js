// Stripe adapter — the "rest of world" recurring-billing provider. Stripe
// owns every recurring charge; this file only (a) creates the Customer +
// Subscription so the mobile PaymentSheet can confirm the first payment /
// mandate, (b) asks Stripe to cancel/resume, and (c) verifies + normalizes
// inbound webhooks. It never computes a renewal or moves money itself.
//
// All raw Stripe vocabulary (status strings, event names, the object shape)
// is translated to the canonical vocabulary in ../canonicalStatus.js here and
// nowhere else.

const { STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET } = require('../../../config/env');
const { SUB_STATUS, EVENT } = require('../canonicalStatus');

const PROVIDER = 'stripe';

let _client = null;
function client() {
  if (!STRIPE_SECRET_KEY) {
    const err = new Error('stripe_not_configured');
    err.code = 'PROVIDER_NOT_CONFIGURED';
    throw err;
  }
  if (!_client) {
    // Lazy require so a backend with no Stripe keys never loads the SDK. No
    // pinned apiVersion — the account default keeps the ephemeral key in step
    // with whatever version the @stripe/stripe-react-native native SDK expects
    // (a mismatch there breaks PaymentSheet). The normalizer below reads the
    // subscription period from either its legacy top-level location or the
    // per-item one, so it survives a version bump.
    const Stripe = require('stripe');
    _client = new Stripe(STRIPE_SECRET_KEY);
  }
  return _client;
}

const configured = () => !!STRIPE_SECRET_KEY;
const webhookConfigured = () => !!STRIPE_SECRET_KEY && !!STRIPE_WEBHOOK_SECRET;

function publishableConfig() {
  return { provider: PROVIDER, publishableKey: STRIPE_PUBLISHABLE_KEY || null };
}

const toIso = (unixSeconds) =>
  unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null;

const intervalToCycle = (interval) =>
  interval === 'year' ? 'yearly' : interval === 'month' ? 'monthly' : null;

// Stripe `unit_amount` is in the currency's minor unit. The Stripe markets
// this app prices in (USD/EUR/GBP/AED/…) are all 2-decimal; INR routes to
// Razorpay, not here. Keep the /100 but tolerate a missing amount.
const minorToMajor = (amount) =>
  amount === null || amount === undefined ? null : Number(amount) / 100;

// ---- Customer + subscription creation (checkout) ----------------------------

async function ensureCustomer({ userId, email, existingCustomerId }) {
  const s = client();
  if (existingCustomerId) {
    try {
      const c = await s.customers.retrieve(existingCustomerId);
      if (c && !c.deleted) return c.id;
    } catch {
      /* fall through and make a fresh one */
    }
  }
  const created = await s.customers.create({
    email: email || undefined,
    metadata: { userId },
  });
  return created.id;
}

async function createEphemeralKey(customerId) {
  // No apiVersion override: let the SDK use the account default so PaymentSheet
  // on the device gets a key it can actually use.
  const key = await client().ephemeralKeys.create({ customer: customerId });
  return key.secret;
}

// Returns everything the app's StripeProvider + PaymentSheet needs. When
// `trialEndUnix` is set (converting an in-progress free trial) there is no
// charge yet, so the client confirms a SetupIntent to capture the mandate
// instead of a PaymentIntent.
async function createSubscription({ userId, customerId, priceId, billingCycle, trialEndUnix }) {
  const s = client();
  const sub = await s.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    trial_end: trialEndUnix || undefined,
    // If a trial is set, Stripe needs somewhere to fall back when the trial
    // ends and the saved method fails — cancel keeps our "provider owns
    // lifecycle" model clean (a failed conversion just expires).
    trial_settings: trialEndUnix
      ? { end_behavior: { missing_payment_method: 'cancel' } }
      : undefined,
    expand: [
      'latest_invoice.payment_intent',
      'latest_invoice.confirmation_secret',
      'pending_setup_intent',
    ],
    metadata: { userId, billingCycle: billingCycle || '' },
  });

  const setupIntent = sub.pending_setup_intent;
  const invoice = sub.latest_invoice || {};
  // Newer Stripe API versions surface the first-payment client secret as
  // `latest_invoice.confirmation_secret`; older ones as
  // `latest_invoice.payment_intent.client_secret`. Support both.
  const paymentSecret =
    (invoice.confirmation_secret && invoice.confirmation_secret.client_secret) ||
    (invoice.payment_intent && invoice.payment_intent.client_secret) ||
    null;
  const clientSecret = setupIntent ? setupIntent.client_secret : paymentSecret;
  const clientSecretType = setupIntent ? 'setup_intent' : 'payment_intent';

  return {
    provider: PROVIDER,
    subscriptionId: sub.id,
    customerId,
    clientSecret,
    clientSecretType,
    publishableKey: STRIPE_PUBLISHABLE_KEY || null,
    normalized: normalizeSubscription(sub),
  };
}

// ---- lifecycle actions -----------------------------------------------------

async function cancelAtPeriodEnd(providerSubscriptionId) {
  const sub = await client().subscriptions.update(providerSubscriptionId, {
    cancel_at_period_end: true,
  });
  return normalizeSubscription(sub);
}

async function resume(providerSubscriptionId) {
  const sub = await client().subscriptions.update(providerSubscriptionId, {
    cancel_at_period_end: false,
  });
  return normalizeSubscription(sub);
}

async function fetchSubscription(providerSubscriptionId) {
  const sub = await client().subscriptions.retrieve(providerSubscriptionId, {
    expand: ['items.data.price'],
  });
  return normalizeSubscription(sub);
}

// ---- webhook verification + normalization ---------------------------------

// Throws on a bad/absent signature — the route turns that into a 400 before
// any DB work. `rawBody` MUST be the exact bytes (Buffer/string) Stripe sent
// (see the express.raw mount in src/app.js).
function verifyWebhook(rawBody, signatureHeader) {
  if (!STRIPE_WEBHOOK_SECRET) {
    const err = new Error('stripe_webhook_not_configured');
    err.code = 'PROVIDER_NOT_CONFIGURED';
    throw err;
  }
  return client().webhooks.constructEvent(rawBody, signatureHeader, STRIPE_WEBHOOK_SECRET);
}

const RAW_STATUS_TO_INTERNAL = {
  trialing: SUB_STATUS.TRIALING,
  active: SUB_STATUS.ACTIVE,
  past_due: SUB_STATUS.PAST_DUE,
  unpaid: SUB_STATUS.EXPIRED, // dunning exhausted
  canceled: SUB_STATUS.CANCELLED,
  incomplete: SUB_STATUS.INCOMPLETE,
  incomplete_expired: SUB_STATUS.EXPIRED,
  paused: SUB_STATUS.PAUSED,
};

// Stripe Subscription object -> our internal row shape (camelCase, ISO dates).
function normalizeSubscription(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const item = obj.items && obj.items.data && obj.items.data[0];
  const price = item && item.price;
  // Newer API versions moved the period onto the item; read either.
  const periodStart = obj.current_period_start ?? (item && item.current_period_start);
  const periodEnd = obj.current_period_end ?? (item && item.current_period_end);
  const cancelAtPeriodEnd = !!obj.cancel_at_period_end;
  const currentPeriodEnd = toIso(periodEnd);
  return {
    provider: PROVIDER,
    userId: (obj.metadata && obj.metadata.userId) || null,
    providerSubscriptionId: obj.id,
    providerCustomerId: typeof obj.customer === 'string' ? obj.customer : obj.customer && obj.customer.id,
    status: RAW_STATUS_TO_INTERNAL[obj.status] || SUB_STATUS.INCOMPLETE,
    providerStatus: obj.status || null,
    billingCycle:
      (obj.metadata && obj.metadata.billingCycle) ||
      (price && price.recurring && intervalToCycle(price.recurring.interval)) ||
      null,
    planId: price && price.id,
    planName: (price && (price.nickname || (price.recurring && `${intervalToCycle(price.recurring.interval)}`))) || null,
    amount: price ? minorToMajor(price.unit_amount) : null,
    currency: (obj.currency || (price && price.currency) || '').toUpperCase() || null,
    trialStartAt: toIso(obj.trial_start),
    trialEndAt: toIso(obj.trial_end),
    currentPeriodStart: toIso(periodStart),
    currentPeriodEnd,
    cancelAtPeriodEnd,
    nextBillingDate: cancelAtPeriodEnd ? null : currentPeriodEnd,
  };
}

// Invoice object -> the subset the handler needs to advance a paid period.
function normalizeInvoice(obj) {
  const line = obj.lines && obj.lines.data && obj.lines.data[0];
  const period = line && line.period;
  const subId =
    (typeof obj.subscription === 'string' && obj.subscription) ||
    (obj.subscription && obj.subscription.id) ||
    (obj.parent && obj.parent.subscription_details && obj.parent.subscription_details.subscription) ||
    null;
  return {
    provider: PROVIDER,
    userId: (obj.subscription_details && obj.subscription_details.metadata && obj.subscription_details.metadata.userId) || null,
    providerSubscriptionId: subId,
    latestInvoiceId: obj.id || null,
    billingReason: obj.billing_reason || null,
    currentPeriodStart: period ? toIso(period.start) : null,
    currentPeriodEnd: period ? toIso(period.end) : null,
    amountPaid: minorToMajor(obj.amount_paid),
    currency: (obj.currency || '').toUpperCase() || null,
    nextPaymentAttempt: toIso(obj.next_payment_attempt),
  };
}

const EVENT_MAP = {
  'customer.subscription.created': EVENT.UPDATED,
  'customer.subscription.updated': EVENT.UPDATED,
  'customer.subscription.deleted': EVENT.CANCELLED,
  'customer.subscription.paused': EVENT.PAUSED,
  'customer.subscription.resumed': EVENT.RESUMED,
  'customer.subscription.trial_will_end': EVENT.TRIAL_WILL_END,
  'invoice.paid': EVENT.PAYMENT_SUCCEEDED,
  'invoice.payment_succeeded': EVENT.PAYMENT_SUCCEEDED,
  'invoice.payment_failed': EVENT.PAYMENT_FAILED,
};

// Verified Stripe event -> canonical envelope the handler consumes.
function normalizeEvent(event) {
  const canonicalType = EVENT_MAP[event.type] || null;
  const obj = event.data && event.data.object;
  const isInvoice = obj && obj.object === 'invoice';
  const sub = isInvoice ? normalizeInvoice(obj) : normalizeSubscription(obj);
  return {
    id: event.id,
    provider: PROVIDER,
    rawType: event.type,
    canonicalType,
    providerSubscriptionId: sub && sub.providerSubscriptionId,
    sub,
  };
}

module.exports = {
  PROVIDER,
  configured,
  webhookConfigured,
  publishableConfig,
  ensureCustomer,
  createEphemeralKey,
  createSubscription,
  cancelAtPeriodEnd,
  resume,
  fetchSubscription,
  verifyWebhook,
  normalizeEvent,
  normalizeSubscription,
};
