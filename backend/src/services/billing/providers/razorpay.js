// Razorpay adapter — the India recurring-billing provider. Razorpay owns
// every recurring charge (UPI AutoPay / card / e-mandate); this file only
// creates the Subscription so the mobile Razorpay Checkout can capture the
// mandate, asks Razorpay to cancel/resume, and verifies + normalizes inbound
// webhooks. It never computes a renewal itself.
//
// All raw Razorpay vocabulary (status strings, event names, entity shape) is
// translated to the canonical vocabulary in ../canonicalStatus.js here and
// nowhere else.

const crypto = require('crypto');
const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET } = require('../../../config/env');
const { SUB_STATUS, EVENT } = require('../canonicalStatus');

const PROVIDER = 'razorpay';

// "Until the user cancels" — Razorpay requires a finite total_count, so use a
// long horizon. Cancellation (cancel_at_cycle_end) stops it well before this.
const TOTAL_COUNT = { monthly: 120, yearly: 10 };

let _client = null;
function client() {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    const err = new Error('razorpay_not_configured');
    err.code = 'PROVIDER_NOT_CONFIGURED';
    throw err;
  }
  if (!_client) {
    const Razorpay = require('razorpay');
    _client = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
  }
  return _client;
}

const configured = () => !!RAZORPAY_KEY_ID && !!RAZORPAY_KEY_SECRET;
const webhookConfigured = () => configured() && !!RAZORPAY_WEBHOOK_SECRET;

function publishableConfig() {
  return { provider: PROVIDER, keyId: RAZORPAY_KEY_ID || null };
}

const toIso = (unixSeconds) =>
  unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null;
const paiseToMajor = (p) => (p === null || p === undefined ? null : Number(p) / 100);

// ---- subscription creation (checkout) ------------------------------------

// `startAtUnix` delays the first real charge (converting an in-progress free
// trial) — Razorpay keeps the subscription `authenticated` until then, having
// already captured the mandate at checkout.
async function createSubscription({ userId, planId, billingCycle, startAtUnix, notes }) {
  const params = {
    plan_id: planId,
    total_count: TOTAL_COUNT[billingCycle] || TOTAL_COUNT.monthly,
    quantity: 1,
    customer_notify: 1,
    notes: { userId, billingCycle: billingCycle || '', ...(notes || {}) },
  };
  if (startAtUnix) params.start_at = startAtUnix;
  const sub = await client().subscriptions.create(params);
  return {
    provider: PROVIDER,
    subscriptionId: sub.id,
    shortUrl: sub.short_url || null,
    keyId: RAZORPAY_KEY_ID,
    normalized: normalizeSubscription(sub),
  };
}

// ---- lifecycle actions -------------------------------------------------

// Razorpay's cancel takes a boolean: true = at cycle end (keep access to the
// end of the paid period), false = immediately.
async function cancelAtPeriodEnd(providerSubscriptionId) {
  const sub = await client().subscriptions.cancel(providerSubscriptionId, true);
  return normalizeSubscription(sub);
}

// There is no "un-cancel" for a cycle-end cancellation in Razorpay. Best
// effort: if it's still only *scheduled* to cancel, a fresh cancel(false=off)
// isn't supported, so callers treat resume as "not supported" for Razorpay
// and the app hides the button. Kept for interface symmetry.
async function resume(providerSubscriptionId) {
  const sub = await client().subscriptions.resume(providerSubscriptionId, { resume_at: 'now' });
  return normalizeSubscription(sub);
}

async function fetchSubscription(providerSubscriptionId) {
  const sub = await client().subscriptions.fetch(providerSubscriptionId);
  return normalizeSubscription(sub);
}

// ---- signature verification ------------------------------------------------

// Checkout handshake (POST /api/billing/verify): the app hands back what
// Razorpay Checkout returned on success. Valid iff
// HMAC_SHA256(payment_id + '|' + subscription_id, KEY_SECRET) === signature.
function verifyCheckoutSignature({ razorpay_payment_id, razorpay_subscription_id, razorpay_signature }) {
  if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) return false;
  const expected = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
    .digest('hex');
  return timingSafeEq(expected, razorpay_signature);
}

// Webhook: HMAC_SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET) === x-razorpay-signature.
// Throws on mismatch so the route 400s before touching the DB. Returns the
// parsed JSON body on success.
function verifyWebhook(rawBody, signatureHeader) {
  if (!RAZORPAY_WEBHOOK_SECRET) {
    const err = new Error('razorpay_webhook_not_configured');
    err.code = 'PROVIDER_NOT_CONFIGURED';
    throw err;
  }
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8');
  const expected = crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET).update(body).digest('hex');
  if (!signatureHeader || !timingSafeEq(expected, signatureHeader)) {
    const err = new Error('invalid_signature');
    err.code = 'WEBHOOK_SIGNATURE_INVALID';
    throw err;
  }
  return JSON.parse(body.toString('utf8'));
}

function timingSafeEq(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// ---- normalization -------------------------------------------------------

const RAW_STATUS_TO_INTERNAL = {
  created: SUB_STATUS.INCOMPLETE,
  authenticated: SUB_STATUS.INCOMPLETE, // mandate captured, first charge pending
  active: SUB_STATUS.ACTIVE,
  pending: SUB_STATUS.PAST_DUE, // a charge failed, retrying
  halted: SUB_STATUS.PAST_DUE, // retries exhausted, awaiting action
  cancelled: SUB_STATUS.CANCELLED,
  completed: SUB_STATUS.EXPIRED,
  expired: SUB_STATUS.EXPIRED,
  paused: SUB_STATUS.PAUSED,
};

function normalizeSubscription(entity, paymentEntity) {
  if (!entity || typeof entity !== 'object') return null;
  const notes = entity.notes || {};
  const cancelScheduled = entity.status === 'active' && !!entity.end_at && !entity.cancel_at;
  const currentEnd = toIso(entity.current_end || entity.charge_at);
  return {
    provider: PROVIDER,
    userId: notes.userId || null,
    providerSubscriptionId: entity.id,
    providerCustomerId: entity.customer_id || null,
    status: RAW_STATUS_TO_INTERNAL[entity.status] || SUB_STATUS.INCOMPLETE,
    providerStatus: entity.status || null,
    billingCycle: notes.billingCycle || null,
    planId: entity.plan_id || null,
    planName: notes.billingCycle ? notes.billingCycle : null,
    amount: paymentEntity ? paiseToMajor(paymentEntity.amount) : null,
    currency: (paymentEntity && paymentEntity.currency) || 'INR',
    trialStartAt: null,
    trialEndAt: entity.start_at ? toIso(entity.start_at) : null,
    currentPeriodStart: toIso(entity.current_start),
    currentPeriodEnd: currentEnd,
    // `has_scheduled_changes` + a future end_at is how a cycle-end cancel
    // shows up before the terminal `subscription.cancelled` event.
    cancelAtPeriodEnd: !!entity.cancel_at || cancelScheduled || false,
    nextBillingDate: entity.status === 'cancelled' ? null : toIso(entity.charge_at),
  };
}

const EVENT_MAP = {
  'subscription.authenticated': EVENT.UPDATED,
  'subscription.activated': EVENT.ACTIVATED,
  'subscription.charged': EVENT.PAYMENT_SUCCEEDED,
  'subscription.updated': EVENT.UPDATED,
  'subscription.pending': EVENT.PAYMENT_FAILED,
  'subscription.halted': EVENT.PAYMENT_FAILED,
  'subscription.cancelled': EVENT.CANCELLED,
  'subscription.completed': EVENT.COMPLETED,
  'subscription.paused': EVENT.PAUSED,
  'subscription.resumed': EVENT.RESUMED,
};

// Parsed+verified Razorpay webhook body -> canonical envelope. `eventId` comes
// from the x-razorpay-event-id header (Razorpay bodies carry no unique id).
function normalizeEvent(body, eventId) {
  const rawType = body && body.event;
  const canonicalType = EVENT_MAP[rawType] || null;
  const payload = (body && body.payload) || {};
  const subEntity = payload.subscription && payload.subscription.entity;
  const payEntity = payload.payment && payload.payment.entity;
  const sub = normalizeSubscription(subEntity, payEntity);
  return {
    id: eventId || `${rawType}:${subEntity && subEntity.id}:${body && body.created_at}`,
    provider: PROVIDER,
    rawType,
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
  createSubscription,
  cancelAtPeriodEnd,
  resume,
  fetchSubscription,
  verifyCheckoutSignature,
  verifyWebhook,
  normalizeEvent,
  normalizeSubscription,
};
