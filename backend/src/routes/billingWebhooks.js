// Provider webhook endpoints — the ONLY unauthenticated part of the billing
// surface. Mounted in src/app.js at /api/billing/webhook BEFORE the JSON body
// parser and the /api rate limiter, so:
//   * each handler verifies the provider signature against the exact raw bytes
//     (express.raw below), and
//   * a burst of provider retries is metered by this router's own generous
//     limiter, not the blanket 300/15min /api limiter.
//
// Response contract (both providers): 400 = bad/absent signature (no retry
// wanted), 200 = accepted (handled or deliberately ignored / replay), 503 =
// that provider isn't configured on this backend, 500 = transient failure ->
// the provider should retry.

const express = require('express');
const rateLimit = require('express-rate-limit');
const { isDevEnv } = require('../config/env');
const { ah } = require('../lib/asyncHandler');
const { securityLog } = require('../lib/securityLog');
const svc = require('../services/subscriptionBillingService');
const stripeAdapter = require('../services/billing/providers/stripe');
const razorpayAdapter = require('../services/billing/providers/razorpay');

const router = express.Router();

// Raw body for signature verification. `type: '*/*'` because providers don't
// always send a pristine application/json content-type on retries.
router.use(express.raw({ type: '*/*', limit: '1mb' }));

// Generous, webhook-only. Providers retry with backoff; a normal volume never
// gets close. Same explicit dev opt-out as every other limiter here.
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDevEnv,
});
router.use(webhookLimiter);

router.post(
  '/stripe',
  ah(async (req, res) => {
    if (!stripeAdapter.webhookConfigured()) {
      return res.status(503).json({ error: 'stripe_not_configured' });
    }
    let event;
    try {
      event = stripeAdapter.verifyWebhook(req.body, req.headers['stripe-signature']);
    } catch (err) {
      securityLog('billing_webhook_bad_signature', { provider: 'stripe', reason: err.message });
      return res.status(400).json({ error: 'invalid_signature' });
    }
    const envelope = stripeAdapter.normalizeEvent(event);
    if (!envelope.canonicalType) {
      return res.status(200).json({ received: true, ignored: event.type });
    }
    await svc.processWebhookEvent(envelope); // throws -> 500 -> Stripe retries
    return res.status(200).json({ received: true });
  })
);

router.post(
  '/razorpay',
  ah(async (req, res) => {
    if (!razorpayAdapter.webhookConfigured()) {
      return res.status(503).json({ error: 'razorpay_not_configured' });
    }
    let body;
    try {
      body = razorpayAdapter.verifyWebhook(req.body, req.headers['x-razorpay-signature']);
    } catch (err) {
      securityLog('billing_webhook_bad_signature', { provider: 'razorpay', reason: err.message });
      return res.status(400).json({ error: 'invalid_signature' });
    }
    const envelope = razorpayAdapter.normalizeEvent(body, req.headers['x-razorpay-event-id']);
    if (!envelope.canonicalType) {
      return res.status(200).json({ received: true, ignored: body && body.event });
    }
    await svc.processWebhookEvent(envelope);
    return res.status(200).json({ received: true });
  })
);

module.exports = router;
