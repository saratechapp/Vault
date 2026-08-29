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

module.exports = { isValidDateStr, emptyToNull, advanceDate };
