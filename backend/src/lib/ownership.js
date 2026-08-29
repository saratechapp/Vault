// Resource-ownership guards for consumer routes. `ownsAccount` is the only
// authorization boundary for consumer data (unlike the admin panel's RBAC) —
// combined with db.js's per-user_id query scoping as defense in depth.
function ownsAccount(userData, id) {
  return !id || userData.accounts.some((a) => a.id === id);
}
function foreignAccountField(userData, body, fields) {
  return fields.find((field) => body[field] && !ownsAccount(userData, body[field])) || null;
}

module.exports = { ownsAccount, foreignAccountField };
