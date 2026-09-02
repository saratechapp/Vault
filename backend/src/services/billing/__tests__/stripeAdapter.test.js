// Stripe adapter: webhook signature verification (accept valid, reject
// tampered) + event normalization to the canonical envelope. Env is set
// BEFORE requiring the adapter because config/env.js snapshots it at load.
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy_key';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_dummy_secret';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const stripeAdapter = require('../providers/stripe');
const { EVENT, SUB_STATUS } = require('../canonicalStatus');
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function signed(payloadObj) {
  const payload = JSON.stringify(payloadObj);
  const header = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  });
  return { payload, header };
}

const subEvent = (overrides = {}) => ({
  id: 'evt_' + Math.random().toString(36).slice(2),
  type: 'customer.subscription.updated',
  data: {
    object: {
      object: 'subscription',
      id: 'sub_123',
      customer: 'cus_123',
      status: 'active',
      cancel_at_period_end: false,
      current_period_start: 1_756_000_000,
      current_period_end: 1_758_678_400,
      trial_start: null,
      trial_end: null,
      metadata: { userId: 'user-abc', billingCycle: 'monthly' },
      items: { data: [{ price: { id: 'price_m', unit_amount: 900, currency: 'usd', recurring: { interval: 'month' } } }] },
      ...overrides,
    },
  },
});

test('verifyWebhook accepts a correctly-signed payload', () => {
  const { payload, header } = signed(subEvent());
  const event = stripeAdapter.verifyWebhook(Buffer.from(payload), header);
  assert.equal(event.type, 'customer.subscription.updated');
});

test('verifyWebhook rejects a tampered body', () => {
  const { payload, header } = signed(subEvent());
  const tampered = payload.replace('"active"', '"trialing"');
  assert.throws(() => stripeAdapter.verifyWebhook(Buffer.from(tampered), header));
});

test('verifyWebhook rejects a wrong/absent signature', () => {
  const { payload } = signed(subEvent());
  assert.throws(() => stripeAdapter.verifyWebhook(Buffer.from(payload), 't=1,v1=deadbeef'));
  assert.throws(() => stripeAdapter.verifyWebhook(Buffer.from(payload), undefined));
});

test('normalizeEvent: customer.subscription.updated (active) -> UPDATED envelope', () => {
  const env = stripeAdapter.normalizeEvent(subEvent());
  assert.equal(env.provider, 'stripe');
  assert.equal(env.canonicalType, EVENT.UPDATED);
  assert.equal(env.providerSubscriptionId, 'sub_123');
  assert.equal(env.sub.status, SUB_STATUS.ACTIVE);
  assert.equal(env.sub.userId, 'user-abc');
  assert.equal(env.sub.billingCycle, 'monthly');
  assert.equal(env.sub.amount, 9); // 900 minor units / 100
  assert.equal(env.sub.currency, 'USD');
  assert.equal(new Date(env.sub.currentPeriodEnd).getTime(), 1_758_678_400 * 1000);
});

test('normalizeEvent: customer.subscription.deleted -> CANCELLED', () => {
  const e = subEvent();
  e.type = 'customer.subscription.deleted';
  e.data.object.status = 'canceled';
  const env = stripeAdapter.normalizeEvent(e);
  assert.equal(env.canonicalType, EVENT.CANCELLED);
  assert.equal(env.sub.status, SUB_STATUS.CANCELLED);
});

test('normalizeEvent: invoice.payment_failed -> PAYMENT_FAILED with the subscription id', () => {
  const env = stripeAdapter.normalizeEvent({
    id: 'evt_x',
    type: 'invoice.payment_failed',
    data: {
      object: {
        object: 'invoice',
        id: 'in_1',
        subscription: 'sub_123',
        next_payment_attempt: 1_759_000_000,
        lines: { data: [{ period: { start: 1_756_000_000, end: 1_758_678_400 } }] },
      },
    },
  });
  assert.equal(env.canonicalType, EVENT.PAYMENT_FAILED);
  assert.equal(env.providerSubscriptionId, 'sub_123');
  assert.equal(env.sub.latestInvoiceId, 'in_1');
});

test('normalizeEvent: invoice.paid -> PAYMENT_SUCCEEDED carrying the new period', () => {
  const env = stripeAdapter.normalizeEvent({
    id: 'evt_y',
    type: 'invoice.paid',
    data: {
      object: {
        object: 'invoice',
        id: 'in_2',
        subscription: 'sub_123',
        billing_reason: 'subscription_cycle',
        amount_paid: 900,
        currency: 'usd',
        lines: { data: [{ period: { start: 1_758_678_400, end: 1_761_356_800 } }] },
      },
    },
  });
  assert.equal(env.canonicalType, EVENT.PAYMENT_SUCCEEDED);
  assert.equal(new Date(env.sub.currentPeriodEnd).getTime(), 1_761_356_800 * 1000);
});

test('normalizeEvent: an unmapped event type -> canonicalType null (route ignores it)', () => {
  const env = stripeAdapter.normalizeEvent({ id: 'evt_z', type: 'charge.succeeded', data: { object: {} } });
  assert.equal(env.canonicalType, null);
});
