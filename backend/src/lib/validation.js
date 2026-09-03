const { iso } = require('../services/shared');

function isValidDateStr(s) {
  return typeof s === 'string' && s.trim() !== '' && !Number.isNaN(new Date(s).getTime());
}

// Empty-string Select values ("— None —" / "Select account") must become
// NULL for uuid-typed FK columns, or Postgres rejects the write outright:
// 'invalid input syntax for type uuid: ""'. Every POST route already builds
// its insert payload with `field || null` for these; PATCH routes instead
// copy body fields into a generic patch object field-by-field and need the
// same coercion applied per-field there.
function emptyToNull(value) {
  return value === '' ? null : value;
}

function advanceDate(dateStr, frequency) {
  const d = new Date(dateStr);
  switch (frequency) {
    case 'daily':
      d.setDate(d.getDate() + 1);
      break;
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1);
      break;
    case 'monthly':
    default:
      d.setMonth(d.getMonth() + 1);
      break;
  }
  return iso(d);
}

// ---------------------------------------------------------------------------
// Shared input hardening for the consumer entity routes (accounts,
// transactions, budgets, bills, goals, debts, templates, categories).
// `PATCH /api/me` already bounds every one of its own fields inline; these
// bring the entity routes to the same standard so a hand-crafted payload
// can't store a multi-megabyte string or push an absurd magnitude into a
// chart axis / downstream fixed-precision column.
//
// Contract: stored text is NOT markup-stripped (React escapes on render and
// a note like "rent < 500" is legitimate) — every consumer of this data
// (web, mobile, CSV export, admin grid, AI prompt context) must treat it as
// untrusted and escape on output. We only remove control characters and cap
// length here.
// ---------------------------------------------------------------------------

// Longest allowed value per free-text field name, keyed the way the route
// handlers already name them.
const STR_CAPS = {
  name: 120,
  vendor: 200,
  institution: 120,
  creditor: 120,
  paymentMethod: 60,
  payer: 120,
  note: 2000,
  category: 120,
  icon: 60,
  color: 32,
  label: 40,
};

// C0 controls (0x00-0x1F) plus DEL and C1 (0x7F-0x9F). Written with \x
// escapes so the source stays plain ASCII.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\x00-\x1F\x7F-\x9F]/g;

// Trim, strip control characters, cap length. Non-strings -> ''.
function cleanStr(value, max = 200) {
  if (typeof value !== 'string') return '';
  return value.replace(CONTROL_CHARS_RE, '').trim().slice(0, max);
}

// A finite number within a sane money/quantity magnitude, or null when the
// input isn't a usable number. Accepts "1,234.50"-style grouped strings.
const MAX_MONEY = 1e12;
function boundedNumber(value, { min = -MAX_MONEY, max = MAX_MONEY } = {}) {
  if (value == null) return null;
  let n;
  if (typeof value === 'number') {
    n = value;
  } else {
    const s = String(value).replace(/,/g, '').trim();
    if (s === '') return null; // empty string is "no value", not 0
    n = Number(s);
  }
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

// Array of short labels: cleaned, de-duped, capped in count and per-item length.
function cleanLabels(value, { maxItems = 20, maxLen = STR_CAPS.label } = {}) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const v of value) {
    const s = cleanStr(v, maxLen);
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

// Cleans every known free-text / label key present on an entity request body,
// in place, so the existing handler code downstream receives already-bounded
// values without each route repeating the same slice/trim calls. Numeric and
// amount validation stays per-route (each has its own required/positivity
// rules); this only touches text.
const TEXT_KEYS = ['name', 'vendor', 'institution', 'creditor', 'paymentMethod', 'payer', 'note', 'category', 'icon', 'color'];
function cleanEntityText(body) {
  if (!body || typeof body !== 'object') return body;
  for (const key of TEXT_KEYS) {
    if (typeof body[key] === 'string') body[key] = cleanStr(body[key], STR_CAPS[key] || 200);
  }
  if ('labels' in body) body.labels = cleanLabels(body.labels);
  return body;
}

module.exports = {
  isValidDateStr,
  emptyToNull,
  advanceDate,
  STR_CAPS,
  MAX_MONEY,
  cleanStr,
  boundedNumber,
  cleanLabels,
  cleanEntityText,
};
