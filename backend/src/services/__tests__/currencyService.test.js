const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveCurrency,
  currencyForCountry,
  regionFromLocale,
  formatMoney,
  yearlySavingsPct,
  yearlyEquivalentMonthly,
} = require('../currencyService');

test('regionFromLocale pulls the country out of a locale tag', () => {
  assert.equal(regionFromLocale('en-IN'), 'IN');
  assert.equal(regionFromLocale('en-GB'), 'GB');
  assert.equal(regionFromLocale('ar-AE'), 'AE');
  assert.equal(regionFromLocale('fr'), 'FR'); // maximize() fills the region
  assert.equal(regionFromLocale(''), null);
});

test('currencyForCountry maps the pricing markets', () => {
  assert.equal(currencyForCountry('IN'), 'INR');
  assert.equal(currencyForCountry('ae'), 'AED');
  assert.equal(currencyForCountry('US'), 'USD');
  assert.equal(currencyForCountry('DE'), 'EUR');
  assert.equal(currencyForCountry('ZZ'), null);
});

test('resolveCurrency: explicit billing preference wins when it is priced', () => {
  const r = resolveCurrency({
    billingCurrency: 'USD',
    profileCurrency: 'INR',
    profileCountry: 'IN',
    enabledCurrencies: ['INR', 'USD'],
    defaultCurrency: 'INR',
  });
  assert.deepEqual(r, { currency: 'USD', source: 'preference' });
});

test('resolveCurrency: a candidate that is not an enabled price currency is skipped', () => {
  const r = resolveCurrency({
    billingCurrency: 'USD', // not priced -> skip
    profileCurrency: 'GBP', // not priced -> skip
    profileCountry: 'AE', // AED priced -> use it
    enabledCurrencies: ['INR', 'AED'],
    defaultCurrency: 'INR',
  });
  assert.deepEqual(r, { currency: 'AED', source: 'billing country' });
});

test('resolveCurrency: falls through profile -> country -> ip -> locale', () => {
  assert.deepEqual(
    resolveCurrency({ profileCurrency: 'INR', enabledCurrencies: ['INR'], defaultCurrency: 'INR' }),
    { currency: 'INR', source: 'account' }
  );
  assert.deepEqual(
    resolveCurrency({ ipCountry: 'GB', enabledCurrencies: ['INR', 'GBP'], defaultCurrency: 'INR' }),
    { currency: 'GBP', source: 'location' }
  );
  assert.deepEqual(
    resolveCurrency({ localeHint: 'en-AE', enabledCurrencies: ['INR', 'AED'], defaultCurrency: 'INR' }),
    { currency: 'AED', source: 'browser locale' }
  );
});

test('resolveCurrency: nothing resolves -> configured default', () => {
  const r = resolveCurrency({
    localeHint: 'en-GB', // GBP not priced
    enabledCurrencies: ['INR'],
    defaultCurrency: 'INR',
  });
  assert.deepEqual(r, { currency: 'INR', source: 'default' });
});

test('formatMoney is locale-aware and drops decimals on whole numbers', () => {
  assert.equal(formatMoney(50, 'INR'), '₹50');
  assert.equal(formatMoney(500, 'INR'), '₹500');
  assert.equal(formatMoney(2, 'USD'), '$2');
  assert.match(formatMoney(500 / 12, 'INR'), /₹41\.67/);
  assert.match(formatMoney(20, 'GBP'), /£20/);
});

test('yearly savings + equivalent monthly', () => {
  assert.equal(yearlySavingsPct(50, 500), 17); // 500 vs 600
  assert.equal(yearlySavingsPct(50, 600), 0); // no saving
  assert.equal(yearlySavingsPct(0, 500), 0); // guard
  assert.equal(yearlyEquivalentMonthly(600), 50);
});
