// subscriptionBillingService — the webhook state machine. The DB layer is
// stubbed by swapping the functions on the shared `db` module object (the
// service holds the same reference), so no query ever runs.
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const db = require('../../db');
const svc = require('../subscriptionBillingService');
const { EVENT, SUB_STATUS } = require('../billing/canonicalStatus');
const { STATUS } = require('../subscriptionService');

const FUTURE = new Date(Date.now() + 20 * 864e5).toISOString();
const PAST = new Date(Date.now() - 5 * 864e5).toISOString();

const baseRow = () => ({
  id: 'row-1',
  userId: 'user-1',
  provider: 'stripe',
  providerSubscriptionId: 'sub_1',
  providerCustomerId: 'cus_1',
  planId: 'price_m',
  planName: 'Monthly',
  billingCycle: 'monthly',
  amount: 9,
  currency: 'USD',
  status: SUB_STATUS.ACTIVE,
  currentPeriodStart: PAST,
  currentPeriodEnd: FUTURE,
  cancelAtPeriodEnd: false,
});

// --- deriveStateForEvent (pure) ------------------------------------------

test('PAYMENT_FAILED -> past_due, periods untouched, NOT revoked', () => {
  const next = svc.deriveStateForEvent(EVENT.PAYMENT_FAILED, baseRow(), {
    providerStatus: 'past_due',
    nextBillingDate: FUTURE,
  });
  assert.equal(next.status, SUB_STATUS.PAST_DUE);
  assert.equal(next.currentPeriodEnd, FUTURE);
});

test('PAYMENT_SUCCEEDED -> active + advanced billing window', () => {
  const NEXT_START = FUTURE;
  const NEXT_END = new Date(Date.now() + 50 * 864e5).toISOString();
  const row = { ...baseRow(), status: SUB_STATUS.PAST_DUE };
  const next = svc.deriveStateForEvent(EVENT.PAYMENT_SUCCEEDED, row, {
    currentPeriodStart: NEXT_START,
    currentPeriodEnd: NEXT_END,
    latestInvoiceId: 'in_9',
  });
  assert.equal(next.status, SUB_STATUS.ACTIVE);
  assert.equal(next.currentPeriodEnd, NEXT_END);
  assert.equal(next.nextBillingDate, NEXT_END);
  assert.equal(next.latestInvoiceId, 'in_9');
});

test('CANCELLED while inside the paid period -> cancelled + cancelAtPeriodEnd (access kept)', () => {
  const next = svc.deriveStateForEvent(EVENT.CANCELLED, baseRow(), { currentPeriodEnd: FUTURE });
  assert.equal(next.status, SUB_STATUS.CANCELLED);
  assert.equal(next.cancelAtPeriodEnd, true);
});

test('CANCELLED after the paid period -> expired', () => {
  const next = svc.deriveStateForEvent(EVENT.CANCELLED, { ...baseRow(), currentPeriodEnd: PAST }, { currentPeriodEnd: PAST });
  assert.equal(next.status, SUB_STATUS.EXPIRED);
});

test('COMPLETED -> expired; PAUSED -> paused; RESUMED -> active + clears cancel flag', () => {
  assert.equal(svc.deriveStateForEvent(EVENT.COMPLETED, baseRow(), {}).status, SUB_STATUS.EXPIRED);
  assert.equal(svc.deriveStateForEvent(EVENT.PAUSED, baseRow(), {}).status, SUB_STATUS.PAUSED);
  const resumed = svc.deriveStateForEvent(EVENT.RESUMED, { ...baseRow(), cancelAtPeriodEnd: true }, {});
  assert.equal(resumed.status, SUB_STATUS.ACTIVE);
  assert.equal(resumed.cancelAtPeriodEnd, false);
});

// --- processWebhookEvent (with stubbed db) ------------------------------

function stubDb(overrides = {}) {
  const calls = { mirror: [], upsert: [], processed: [] };
  const saved = {};
  for (const k of [
    'recordSubscriptionEvent', 'getSubscriptionByProviderId', 'upsertSubscriptionRecord',
    'mirrorSubscriptionToProfile', 'markSubscriptionEventProcessed',
  ]) {
    saved[k] = db[k];
  }
  db.recordSubscriptionEvent = async () => ({ created: true, event: { processedAt: null } });
  db.getSubscriptionByProviderId = async () => baseRow();
  db.upsertSubscriptionRecord = async (patch) => {
    calls.upsert.push(patch);
    return { ...baseRow(), ...patch };
  };
  db.mirrorSubscriptionToProfile = async (userId, mirror) => {
    calls.mirror.push({ userId, mirror });
  };
  db.markSubscriptionEventProcessed = async (id, err) => {
    calls.processed.push({ id, err });
  };
  Object.assign(db, overrides);
  return {
    calls,
    restore: () => Object.assign(db, saved),
  };
}

test('processWebhookEvent: a replayed (already-processed) event is a no-op', async () => {
  const s = stubDb({
    recordSubscriptionEvent: async () => ({ created: false, event: { processedAt: new Date().toISOString() } }),
    getSubscriptionByProviderId: async () => {
      throw new Error('should not be called on a replay');
    },
  });
  try {
    const out = await svc.processWebhookEvent({
      id: 'evt_dup', provider: 'stripe', rawType: 'invoice.paid',
      canonicalType: EVENT.PAYMENT_SUCCEEDED, providerSubscriptionId: 'sub_1',
      sub: { currentPeriodEnd: FUTURE },
    });
    assert.deepEqual(out, { handled: true, replay: true });
  } finally {
    s.restore();
  }
});

test('processWebhookEvent: a half-processed event (recorded, processed_at null) IS retried', async () => {
  const s = stubDb({
    recordSubscriptionEvent: async () => ({ created: false, event: { processedAt: null } }),
  });
  try {
    await svc.processWebhookEvent({
      id: 'evt_retry', provider: 'stripe', rawType: 'customer.subscription.updated',
      canonicalType: EVENT.UPDATED, providerSubscriptionId: 'sub_1',
      sub: { status: SUB_STATUS.ACTIVE, currentPeriodEnd: FUTURE },
    });
    assert.equal(s.calls.mirror.length, 1, 'reprocessed -> mirrored');
    assert.equal(s.calls.processed[0].id, 'evt_retry');
  } finally {
    s.restore();
  }
});

test('processWebhookEvent: ACTIVATED mirrors subscriptionType ACTIVE onto the profile', async () => {
  const s = stubDb();
  try {
    await svc.processWebhookEvent({
      id: 'evt_act', provider: 'stripe', rawType: 'customer.subscription.updated',
      canonicalType: EVENT.ACTIVATED, providerSubscriptionId: 'sub_1',
      sub: { status: SUB_STATUS.ACTIVE, currentPeriodStart: PAST, currentPeriodEnd: FUTURE, billingCycle: 'monthly' },
    });
    assert.equal(s.calls.mirror.length, 1);
    assert.equal(s.calls.mirror[0].mirror.subscriptionType, STATUS.ACTIVE);
    assert.equal(s.calls.mirror[0].mirror.subscriptionEndsAt, FUTURE);
  } finally {
    s.restore();
  }
});

test('processWebhookEvent: PAYMENT_FAILED does NOT drop premium before period end', async () => {
  const s = stubDb();
  try {
    await svc.processWebhookEvent({
      id: 'evt_fail', provider: 'razorpay', rawType: 'subscription.halted',
      canonicalType: EVENT.PAYMENT_FAILED, providerSubscriptionId: 'sub_1',
      sub: { providerStatus: 'halted' },
    });
    // row goes past_due, but the mirror still says ACTIVE until FUTURE
    assert.equal(s.calls.upsert[0].status, SUB_STATUS.PAST_DUE);
    assert.equal(s.calls.mirror[0].mirror.subscriptionType, STATUS.ACTIVE);
    assert.equal(s.calls.mirror[0].mirror.subscriptionEndsAt, FUTURE);
  } finally {
    s.restore();
  }
});

test('processWebhookEvent: an orphan event (no row, no identifiable user) is a safe no-op', async () => {
  const s = stubDb({ getSubscriptionByProviderId: async () => null });
  try {
    const out = await svc.processWebhookEvent({
      id: 'evt_orphan', provider: 'stripe', rawType: 'customer.subscription.updated',
      canonicalType: EVENT.UPDATED, providerSubscriptionId: 'sub_unknown',
      sub: { status: SUB_STATUS.ACTIVE }, // no userId
    });
    assert.equal(out.handled, true);
    assert.equal(s.calls.mirror.length, 0);
  } finally {
    s.restore();
  }
});

test('processWebhookEvent: a handler error marks the event with the error and rethrows (-> 500 -> retry)', async () => {
  const s = stubDb({
    mirrorSubscriptionToProfile: async () => {
      throw new Error('db exploded');
    },
  });
  try {
    await assert.rejects(
      svc.processWebhookEvent({
        id: 'evt_err', provider: 'stripe', rawType: 'customer.subscription.updated',
        canonicalType: EVENT.UPDATED, providerSubscriptionId: 'sub_1',
        sub: { status: SUB_STATUS.ACTIVE, currentPeriodEnd: FUTURE },
      }),
      /db exploded/
    );
    assert.equal(s.calls.processed[0].err, 'db exploded');
  } finally {
    s.restore();
  }
});
