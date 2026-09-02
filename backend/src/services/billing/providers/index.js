// Provider registry + routing. The rest of the billing code asks here for
// "the provider that should handle this user" or "the adapter named X" and
// never imports stripe.js / razorpay.js directly — so adding a third provider
// later is one entry in this file.

const { SUBSCRIPTION_PROVIDER_MAP } = require('../../../config/env');
const stripe = require('./stripe');
const razorpay = require('./razorpay');

const ADAPTERS = { stripe, razorpay };

// Parse "IN:razorpay,US:stripe,*:stripe" once. Keys are upper-cased 2-letter
// country codes or "*". Unknown providers in the string are ignored.
const ROUTES = (() => {
  const out = {};
  for (const pair of String(SUBSCRIPTION_PROVIDER_MAP || '').split(',')) {
    const [rawKey, rawVal] = pair.split(':').map((s) => (s || '').trim());
    if (!rawKey || !rawVal || !ADAPTERS[rawVal.toLowerCase()]) continue;
    out[rawKey.toUpperCase()] = rawVal.toLowerCase();
  }
  if (!out['*']) out['*'] = 'stripe';
  return out;
})();

function get(name) {
  return ADAPTERS[String(name || '').toLowerCase()] || null;
}

// Which provider name should collect this user's recurring payment. `country`
// is profiles.country (or the geo-resolved one); `currency` is the resolved
// billing currency — INR always implies Razorpay regardless of the country
// map, since Stripe can't settle INR mandates for Indian cardholders.
function pickProviderName({ country, currency }) {
  if (String(currency || '').toUpperCase() === 'INR') return 'razorpay';
  const cc = String(country || '').toUpperCase();
  return ROUTES[cc] || ROUTES['*'];
}

// The adapter to use, plus whether it's actually usable (keys present).
function pickProvider({ country, currency }) {
  const name = pickProviderName({ country, currency });
  const adapter = get(name);
  return { name, adapter, configured: !!adapter && adapter.configured() };
}

function enabledProviders() {
  return Object.keys(ADAPTERS).filter((n) => ADAPTERS[n].configured());
}

module.exports = { get, pickProvider, pickProviderName, enabledProviders, ADAPTERS };
