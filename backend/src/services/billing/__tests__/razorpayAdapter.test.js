// Razorpay adapter: webhook + checkout signature verification (accept valid,
// reject tampered) + event normalization. Env set before require (config/env.js
// snapshots it at load).
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
process.env.RAZORPAY_KEY_ID = 'rzp_test_dummy';
process.env.RAZORPAY_KEY_SECRET = 'secret_dummy';
process.env.RAZORPAY_WEBHOOK_SECRET = 'whsecret_dummy';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const rzp = require('../providers/razorpay');
const { EVENT, SUB_STATUS } = require('../canonicalStatus');

const hmac = (body, secret) => crypto.createHmac('sha256', secret).update(body).digest('hex');

const chargedBody = (subOverrides = {}) => ({
  event: 'subscription.charged',
  created_at: 1_756_000_100,
  payload: {
    subscription: {
      entity: {
        id: 'sub_rzp_1',
        plan_id: 'plan_m',
        status: 'active',
        current_start: 1_756_000_000,
        current_end: 1_758_678_400,
        charge_at: 1_758_678_400,
        customer_id: 'cust_1',
        notes: { userId: 'user-xyz', billingCycle: 'monthly' },
        ...subOverrides,
      },
    },
    payment: { entity: { amount: 9900, currency: 'INR', status: 'captured' } },
  },
});

test('verifyWebhook accepts a correctly-signed body and returns parsed JSON', () => {
  const raw = Buffer.from(JSON.stringify(chargedBody()));
  const sig = hmac(raw, process.env.RAZORPAY_WEBHOOK_SECRET);
  const parsed = rzp.verifyWebhook(raw, sig);
  assert.equal(parsed.event, 'subscription.charged');
});

test('verifyWebhook rejects a tampered body', () => {
  const raw = Buffer.from(JSON.stringify(chargedBody()));
  const sig = hmac(raw, process.env.RAZORPAY_WEBHOOK_SECRET);
  const tampered = Buffer.from(raw.toString().replace('"active"', '"halted"'));
  assert.throws(() => rzp.verifyWebhook(tampered, sig), /invalid_signature/);
});

test('verifyWebhook rejects a wrong secret / missing header', () => {
  const raw = Buffer.from(JSON.stringify(chargedBody()));
  assert.throws(() => rzp.verifyWebhook(raw, hmac(raw, 'not-the-secret')));
  assert.throws(() => rzp.verifyWebhook(raw, undefined));
});

test('verifyCheckoutSignature: valid iff HMAC(payment_id|subscription_id, key_secret) matches', () => {
  const razorpay_payment_id = 'pay_1';
  const razorpay_subscription_id = 'sub_rzp_1';
  const good = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
    .digest('hex');
  assert.equal(
    rzp.verifyCheckoutSignature({ razorpay_payment_id, razorpay_subscription_id, razorpay_signature: good }),
    true
  );
  assert.equal(
    rzp.verifyCheckoutSignature({ razorpay_payment_id, razorpay_subscription_id, razorpay_signature: 'nope' }),
    false
  );
  assert.equal(rzp.verifyCheckoutSignature({}), false);
});

test('normalizeEvent: subscription.charged -> PAYMENT_SUCCEEDED, amount from payment entity (minor units)', () => {
  const env = rzp.normalizeEvent(chargedBody(), 'evt_hdr_1');
  assert.equal(env.id, 'evt_hdr_1');
  assert.equal(env.provider, 'razorpay');
  assert.equal(env.canonicalType, EVENT.PAYMENT_SUCCEEDED);
  assert.equal(env.providerSubscriptionId, 'sub_rzp_1');
  assert.equal(env.sub.status, SUB_STATUS.ACTIVE);
  assert.equal(env.sub.userId, 'user-xyz');
  assert.equal(env.sub.amount, 99); // 9900 paise / 100
  assert.equal(env.sub.currency, 'INR');
});

test('normalizeEvent: falls back to a synthetic id when the x-razorpay-event-id header is absent', () => {
  const env = rzp.normalizeEvent(chargedBody(), undefined);
  assert.match(env.id, /^subscription\.charged:sub_rzp_1:/);
});

test('normalizeEvent: activated / halted / cancelled / completed map correctly', () => {
  const mk = (event, entity) => ({ event, created_at: 1, payload: { subscription: { entity: { id: 's', notes: {}, ...entity } } } });
  assert.equal(rzp.normalizeEvent(mk('subscription.activated', { status: 'active' }), 'e1').canonicalType, EVENT.ACTIVATED);
  assert.equal(rzp.normalizeEvent(mk('subscription.halted', { status: 'halted' }), 'e2').canonicalType, EVENT.PAYMENT_FAILED);
  assert.equal(rzp.normalizeEvent(mk('subscription.halted', { status: 'halted' }), 'e2').sub.status, SUB_STATUS.PAST_DUE);
  assert.equal(rzp.normalizeEvent(mk('subscription.cancelled', { status: 'cancelled' }), 'e3').canonicalType, EVENT.CANCELLED);
  assert.equal(rzp.normalizeEvent(mk('subscription.completed', { status: 'completed' }), 'e4').canonicalType, EVENT.COMPLETED);
  assert.equal(rzp.normalizeEvent(mk('subscription.completed', { status: 'completed' }), 'e4').sub.status, SUB_STATUS.EXPIRED);
});
