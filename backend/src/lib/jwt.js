// Reads a JWT's `iat` claim without verifying the signature — verification
// already happened via supabase.auth.getUser(token) just before this is
// called. Used only to compare against profiles.sessions_invalidated_at for
// Force Logout (see backend/src/routes/admin/users.js — there's no documented
// Supabase Admin API call to invalidate a specific user's existing sessions
// by id, so this is the portable mechanism instead).
function decodeJwtIssuedAt(token) {
  try {
    const payload = token.split('.')[1];
    const json = Buffer.from(payload, 'base64url').toString('utf8');
    const claims = JSON.parse(json);
    return typeof claims.iat === 'number' ? claims.iat * 1000 : null;
  } catch {
    return null;
  }
}

module.exports = { decodeJwtIssuedAt };
