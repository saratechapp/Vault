// Pure subscription/trial helpers for the consumer UI. Mirrors the backend's
// services/subscriptionService.js so the drawer, the header chip and the
// /app/subscription page can render a *live* countdown straight from the ISO
// end date the API returns — no day count is ever stored in component state
// or props as a literal.

export const SUBSCRIPTION_STATUS = Object.freeze({
  FREE_ACCESS: 'FREE_ACCESS',
  FREE_TRIAL: 'FREE_TRIAL',
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
});

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Whole days from now until `endISO`, ceiled, floored at 0 — matches
// subscriptionService.daysRemaining on the backend.
export function daysRemaining(endISO, now = new Date()) {
  if (!endISO) return 0;
  const end = new Date(endISO);
  if (Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / MS_PER_DAY));
}

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

const LABELS = {
  FREE_ACCESS: 'Free access',
  FREE_TRIAL: 'Free trial',
  ACTIVE: 'Active',
  EXPIRED: 'Trial expired',
  CANCELLED: 'Cancelled',
};

export function statusLabel(status) {
  return LABELS[status] || 'Free access';
}

export function isTrial(sub) {
  return sub?.status === SUBSCRIPTION_STATUS.FREE_TRIAL;
}

export function isExpired(sub) {
  return sub?.status === SUBSCRIPTION_STATUS.EXPIRED;
}

// Locale-aware currency string. The backend already sends *Formatted strings
// for every price it returns; this is only for the rare client-side compute
// (e.g. an optimistic value before the PATCH round-trips). Whole numbers
// show no decimals.
const CURRENCY_LOCALE = {
  INR: 'en-IN', USD: 'en-US', GBP: 'en-GB', EUR: 'de-DE', AED: 'en-AE',
};

export function formatMoney(amount, currency = 'INR') {
  const value = Number(amount) || 0;
  const fraction = Number.isInteger(value) ? 0 : 2;
  try {
    return new Intl.NumberFormat(CURRENCY_LOCALE[currency] || undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: fraction,
      maximumFractionDigits: fraction,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(fraction)}`;
  }
}

// 🇮🇳 from "INR", 🇬🇧 from "GBP", … — first two letters of an ISO 4217 code
// are the ISO 3166 country in almost every case we price in.
export function currencyFlag(code = '') {
  const cc = code.slice(0, 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return '';
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
