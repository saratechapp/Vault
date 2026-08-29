// Pure currency-resolution + formatting logic for subscription pricing.
// No DB access — callers pass in the profile fields, the enabled price
// currencies and the configured default, and get back which currency to
// show. Mirrors the subset of frontend/src/lib/preferences.js (CURRENCIES /
// COUNTRIES) that pricing needs, kept deliberately small.
//
// Prices are NEVER FX-converted here. This module only decides *which*
// admin-configured price row to display.

// symbol/locale/name for the currencies pricing can be set in. Extend as the
// Super Admin adds markets; anything missing still works (formatMoney falls
// back to Intl's own symbol + an en-US grouping).
const CURRENCY_META = {
  INR: { symbol: '₹', locale: 'en-IN', name: 'Indian Rupee' },
  USD: { symbol: '$', locale: 'en-US', name: 'US Dollar' },
  GBP: { symbol: '£', locale: 'en-GB', name: 'British Pound' },
  EUR: { symbol: '€', locale: 'de-DE', name: 'Euro' },
  AED: { symbol: 'AED', locale: 'en-AE', name: 'UAE Dirham' },
  SAR: { symbol: 'SAR', locale: 'en-SA', name: 'Saudi Riyal' },
  QAR: { symbol: 'QAR', locale: 'en-QA', name: 'Qatari Riyal' },
  KWD: { symbol: 'KWD', locale: 'en-KW', name: 'Kuwaiti Dinar' },
  BHD: { symbol: 'BHD', locale: 'en-BH', name: 'Bahraini Dinar' },
  OMR: { symbol: 'OMR', locale: 'en-OM', name: 'Omani Rial' },
  AUD: { symbol: 'A$', locale: 'en-AU', name: 'Australian Dollar' },
  CAD: { symbol: 'C$', locale: 'en-CA', name: 'Canadian Dollar' },
  SGD: { symbol: 'S$', locale: 'en-SG', name: 'Singapore Dollar' },
  HKD: { symbol: 'HK$', locale: 'en-HK', name: 'Hong Kong Dollar' },
  NZD: { symbol: 'NZ$', locale: 'en-NZ', name: 'New Zealand Dollar' },
  JPY: { symbol: '¥', locale: 'ja-JP', name: 'Japanese Yen' },
  CNY: { symbol: '¥', locale: 'zh-CN', name: 'Chinese Yuan' },
  CHF: { symbol: 'CHF', locale: 'de-CH', name: 'Swiss Franc' },
  ZAR: { symbol: 'R', locale: 'en-ZA', name: 'South African Rand' },
  MYR: { symbol: 'RM', locale: 'ms-MY', name: 'Malaysian Ringgit' },
  IDR: { symbol: 'Rp', locale: 'id-ID', name: 'Indonesian Rupiah' },
  PHP: { symbol: '₱', locale: 'en-PH', name: 'Philippine Peso' },
  THB: { symbol: '฿', locale: 'th-TH', name: 'Thai Baht' },
  VND: { symbol: '₫', locale: 'vi-VN', name: 'Vietnamese Dong' },
  PKR: { symbol: '₨', locale: 'en-PK', name: 'Pakistani Rupee' },
  BDT: { symbol: '৳', locale: 'bn-BD', name: 'Bangladeshi Taka' },
  LKR: { symbol: 'Rs', locale: 'si-LK', name: 'Sri Lankan Rupee' },
  NPR: { symbol: 'Rs', locale: 'ne-NP', name: 'Nepalese Rupee' },
  BRL: { symbol: 'R$', locale: 'pt-BR', name: 'Brazilian Real' },
  MXN: { symbol: 'MX$', locale: 'es-MX', name: 'Mexican Peso' },
  TRY: { symbol: '₺', locale: 'tr-TR', name: 'Turkish Lira' },
  PLN: { symbol: 'zł', locale: 'pl-PL', name: 'Polish Zloty' },
  SEK: { symbol: 'kr', locale: 'sv-SE', name: 'Swedish Krona' },
};

// 2-letter country -> currency. Subset of frontend COUNTRIES covering the
// markets pricing is plausibly set in; the euro zone maps to EUR.
const COUNTRY_TO_CURRENCY = {
  IN: 'INR', US: 'USD', GB: 'GBP', AE: 'AED', SA: 'SAR', QA: 'QAR', KW: 'KWD', BH: 'BHD',
  OM: 'OMR', AU: 'AUD', CA: 'CAD', SG: 'SGD', HK: 'HKD', NZ: 'NZD', JP: 'JPY', CN: 'CNY',
  CH: 'CHF', ZA: 'ZAR', MY: 'MYR', ID: 'IDR', PH: 'PHP', TH: 'THB', VN: 'VND', PK: 'PKR',
  BD: 'BDT', LK: 'LKR', NP: 'NPR', BR: 'BRL', MX: 'MXN', TR: 'TRY', PL: 'PLN', SE: 'SEK',
  DE: 'EUR', FR: 'EUR', IE: 'EUR', IT: 'EUR', ES: 'EUR', PT: 'EUR', NL: 'EUR', BE: 'EUR',
  AT: 'EUR', FI: 'EUR', GR: 'EUR',
};

function currencyMeta(code) {
  return CURRENCY_META[code] || { symbol: code, locale: 'en-US', name: code };
}

// "en-IN" -> "IN". Uses Intl.Locale (maximize() fills a missing region),
// falls back to a trailing-region regex. Mirrors preferences.js.
function regionFromLocale(tag) {
  if (!tag || typeof tag !== 'string') return null;
  try {
    if (typeof Intl.Locale === 'function') {
      const loc = new Intl.Locale(tag);
      const region = loc.region || (loc.maximize && loc.maximize().region);
      if (region) return String(region).toUpperCase();
    }
  } catch {
    /* fall through to regex */
  }
  const m = tag.match(/-([A-Za-z]{2})(?:$|-)/);
  return m ? m[1].toUpperCase() : null;
}

function currencyForCountry(cc) {
  if (!cc) return null;
  return COUNTRY_TO_CURRENCY[String(cc).toUpperCase()] || null;
}

// Priority chain (spec §3), each candidate accepted only if it's an enabled
// pricing currency; otherwise fall through. Returns { currency, source }.
function resolveCurrency({
  billingCurrency,
  profileCurrency,
  profileCountry,
  ipCountry,
  localeHint,
  enabledCurrencies = [],
  defaultCurrency = 'INR',
} = {}) {
  const enabled = new Set((enabledCurrencies || []).map((c) => String(c).toUpperCase()));
  const ok = (code) => code && enabled.has(String(code).toUpperCase());

  const candidates = [
    ['preference', billingCurrency && String(billingCurrency).toUpperCase()],
    ['account', profileCurrency && String(profileCurrency).toUpperCase()],
    ['billing country', currencyForCountry(profileCountry)],
    ['location', currencyForCountry(ipCountry)],
    ['browser locale', currencyForCountry(regionFromLocale(localeHint))],
  ];
  for (const [source, code] of candidates) {
    if (ok(code)) return { currency: String(code).toUpperCase(), source };
  }
  return { currency: String(defaultCurrency || 'INR').toUpperCase(), source: 'default' };
}

// Locale-aware currency string. Whole numbers show no decimals (₹50, not
// ₹50.00); fractional amounts show up to 2 (the yearly-equivalent-monthly).
function formatMoney(amount, currency) {
  const value = Number(amount) || 0;
  const { locale } = currencyMeta(currency);
  const fractionDigits = Number.isInteger(value) ? 0 : 2;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value);
  } catch {
    const { symbol } = currencyMeta(currency);
    return `${symbol}${value.toFixed(fractionDigits)}`;
  }
}

// Percent saved by paying yearly vs 12 monthly payments. 50/500 -> 17.
function yearlySavingsPct(monthly, yearly) {
  const m = Number(monthly) || 0;
  const y = Number(yearly) || 0;
  if (m <= 0) return 0;
  const full = m * 12;
  if (y >= full || full === 0) return 0;
  return Math.round(100 * (1 - y / full));
}

function yearlyEquivalentMonthly(yearly) {
  return (Number(yearly) || 0) / 12;
}

module.exports = {
  CURRENCY_META,
  COUNTRY_TO_CURRENCY,
  currencyMeta,
  regionFromLocale,
  currencyForCountry,
  resolveCurrency,
  formatMoney,
  yearlySavingsPct,
  yearlyEquivalentMonthly,
};
