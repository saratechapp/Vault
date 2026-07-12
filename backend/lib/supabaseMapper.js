// Row <-> camelCase mapping helpers, shared by db.js (per-user entity tables)
// and adminDb.js (cross-user admin queries) so both use one field-map
// convention instead of duplicating it. Extracted from db.js verbatim — no
// behavior change.

function rowToCamel(row, fields) {
  if (!row) return null;
  const out = {};
  fields.forEach(([snake, camel]) => { out[camel] = row[snake]; });
  return out;
}

function rowsToCamel(rows, fields) {
  return (rows || []).map((r) => rowToCamel(r, fields));
}

// Builds a snake_case column patch from a camelCase JS object, only including
// keys actually present on `data` (so partial PATCH-style updates never
// clobber columns the caller didn't touch) and always skipping `id` —
// Postgres owns it (gen_random_uuid() on insert), it's never reassigned.
function camelToSnakePatch(data, fields) {
  const out = {};
  fields.forEach(([snake, camel]) => {
    if (snake === 'id') return;
    if (Object.prototype.hasOwnProperty.call(data, camel)) out[snake] = data[camel];
  });
  return out;
}

module.exports = { rowToCamel, rowsToCamel, camelToSnakePatch };
