// One-off / re-runnable: create the Stripe Products+Prices and Razorpay Plans
// that back each enabled row in `subscription_prices`, then write the ids back
// onto that row (stripe_price_monthly / _yearly, razorpay_plan_monthly /
// _yearly). Nothing in the app ever hardcodes a plan id — this is how they get
// there.
//
//   node scripts/seed-provider-plans.js            # all enabled currencies
//   node scripts/seed-provider-plans.js INR USD    # just these
//   DRY_RUN=1 node scripts/seed-provider-plans.js  # print, don't write
//
// Idempotent: a row that already has an id for a given provider+cycle is left
// alone. Needs STRIPE_SECRET_KEY and/or RAZORPAY_KEY_ID+SECRET in the env
// (backend/.env). A provider with no keys is skipped, not an error.

require('dotenv').config();
const db = require('../src/db');
const { STRIPE_SECRET_KEY, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = require('../src/config/env');

const DRY = !!process.env.DRY_RUN;
const only = process.argv.slice(2).map((s) => s.toUpperCase());

// Stripe wants the amount in the currency minor unit; the markets Stripe
// serves here are all 2-decimal. INR routes to Razorpay.
const toMinor = (major) => Math.round(Number(major) * 100);

async function seedStripe(rows) {
  if (!STRIPE_SECRET_KEY) {
    console.log('· Stripe: no STRIPE_SECRET_KEY — skipped');
    return {};
  }
  const Stripe = require('stripe');
  const stripe = new Stripe(STRIPE_SECRET_KEY);
  const out = {};
  for (const row of rows) {
    if (row.currency === 'INR') continue; // Razorpay market
    const patch = {};
    for (const cycle of ['monthly', 'yearly']) {
      const existing = cycle === 'monthly' ? row.stripePriceMonthly : row.stripePriceYearly;
      const amount = cycle === 'monthly' ? row.monthlyPrice : row.yearlyPrice;
      if (existing) {
        console.log(`  stripe ${row.currency} ${cycle}: already ${existing}`);
        continue;
      }
      if (!amount || amount <= 0) {
        console.log(`  stripe ${row.currency} ${cycle}: price is 0 — skipped`);
        continue;
      }
      if (DRY) {
        console.log(`  stripe ${row.currency} ${cycle}: WOULD create price ${amount} ${row.currency}`);
        continue;
      }
      const product = await stripe.products.create({
        name: `Vault Wallet Premium (${cycle}, ${row.currency})`,
      });
      const price = await stripe.prices.create({
        product: product.id,
        currency: row.currency.toLowerCase(),
        unit_amount: toMinor(amount),
        recurring: { interval: cycle === 'monthly' ? 'month' : 'year' },
      });
      patch[cycle === 'monthly' ? 'stripePriceMonthly' : 'stripePriceYearly'] = price.id;
      console.log(`  stripe ${row.currency} ${cycle}: created ${price.id}`);
    }
    if (Object.keys(patch).length) out[row.currency] = { ...(out[row.currency] || {}), ...patch };
  }
  return out;
}

async function seedRazorpay(rows) {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    console.log('· Razorpay: no keys — skipped');
    return {};
  }
  const Razorpay = require('razorpay');
  const rzp = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
  const out = {};
  for (const row of rows) {
    const patch = {};
    for (const cycle of ['monthly', 'yearly']) {
      const existing = cycle === 'monthly' ? row.razorpayPlanMonthly : row.razorpayPlanYearly;
      const amount = cycle === 'monthly' ? row.monthlyPrice : row.yearlyPrice;
      if (existing) {
        console.log(`  razorpay ${row.currency} ${cycle}: already ${existing}`);
        continue;
      }
      if (!amount || amount <= 0) {
        console.log(`  razorpay ${row.currency} ${cycle}: price is 0 — skipped`);
        continue;
      }
      if (DRY) {
        console.log(`  razorpay ${row.currency} ${cycle}: WOULD create plan ${amount} ${row.currency}`);
        continue;
      }
      const plan = await rzp.plans.create({
        period: cycle === 'monthly' ? 'monthly' : 'yearly',
        interval: 1,
        item: {
          name: `Vault Wallet Premium (${cycle}, ${row.currency})`,
          amount: toMinor(amount),
          currency: row.currency,
        },
      });
      patch[cycle === 'monthly' ? 'razorpayPlanMonthly' : 'razorpayPlanYearly'] = plan.id;
      console.log(`  razorpay ${row.currency} ${cycle}: created ${plan.id}`);
    }
    if (Object.keys(patch).length) out[row.currency] = { ...(out[row.currency] || {}), ...patch };
  }
  return out;
}

(async () => {
  let rows = await db.getSubscriptionPrices();
  rows = rows.filter((r) => r.enabled && (only.length === 0 || only.includes(r.currency)));
  if (rows.length === 0) {
    console.log('No matching enabled subscription_prices rows. Add prices in the admin panel first.');
    process.exit(0);
  }
  console.log(`Seeding provider plans for: ${rows.map((r) => r.currency).join(', ')}${DRY ? '  (DRY RUN)' : ''}`);

  const stripePatches = await seedStripe(rows);
  const razorpayPatches = await seedRazorpay(rows);

  if (DRY) {
    console.log('\nDRY RUN — nothing written.');
    process.exit(0);
  }

  const byCurrency = {};
  for (const [cur, p] of Object.entries(stripePatches)) byCurrency[cur] = { ...(byCurrency[cur] || {}), ...p };
  for (const [cur, p] of Object.entries(razorpayPatches)) byCurrency[cur] = { ...(byCurrency[cur] || {}), ...p };

  for (const [currency, patch] of Object.entries(byCurrency)) {
    await db.upsertSubscriptionPrice(currency, patch, null);
    console.log(`✔ wrote ${Object.keys(patch).join(', ')} onto ${currency}`);
  }
  console.log('\nDone. Verify in the admin panel (Subscriptions → Pricing) or the DB.');
  process.exit(0);
})().catch((err) => {
  console.error('seed-provider-plans failed:', err);
  process.exit(1);
});
