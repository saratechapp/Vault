const { supabase } = require('../supabaseClient');
const db = require('../db');
const adminDb = require('../adminDb');
const { decodeJwtIssuedAt } = require('../lib/jwt');
const { securityLog } = require('../lib/securityLog');

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'unauthorized' });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      securityLog('invalid_or_expired_token', { ip: req.ip, path: req.path });
      return res.status(401).json({ error: 'unauthorized' });
    }
    req.userId = data.user.id;
    req.userEmail = data.user.email;
    req.token = token;
    req.userData = await db.getUserBundle(req.userId);
    req.userPlan = req.userData.plan;

    // Suspension (admin panel's User Management) — re-checked on every
    // request, not just login, since a JWT issued before a suspension
    // doesn't reflect it.
    if (req.userData.status === 'suspended') {
      securityLog('suspended_account_blocked', { userId: req.userId, path: req.path });
      return res.status(403).json({ error: 'account_suspended' });
    }
    // Force Logout — see decodeJwtIssuedAt's comment for why this exists
    // instead of an Admin API call.
    if (req.userData.sessionsInvalidatedAt) {
      const issuedAtMs = decodeJwtIssuedAt(token);
      const invalidatedMs = new Date(req.userData.sessionsInvalidatedAt).getTime();
      if (issuedAtMs !== null && issuedAtMs < invalidatedMs) {
        securityLog('force_logout_token_rejected', { userId: req.userId, path: req.path });
        return res.status(401).json({ error: 'session_revoked' });
      }
    }
    // Surfaces to buildSafeUser so the consumer app can render its
    // impersonation banner — the actual expiry enforcement (independent of
    // the Supabase JWT's own TTL) is this same lookup. isAdmin alongside it
    // is UI-visibility only (the topbar's "Super Admin" button) — every
    // /api/admin/* route still independently re-verifies via
    // requireAdminAuth regardless of what this flag says.
    [req.impersonation, req.isAdmin] = await Promise.all([
      adminDb.getActiveImpersonationSession(req.userId),
      adminDb.isActiveAdmin(req.userId),
    ]);

    // Per-device session revocation (mobile Settings > Security > Sessions,
    // see 0022_sessions.sql) — a bespoke, backend-enforced gate independent
    // of Supabase's own session lifecycle, since supabase-js's admin API has
    // no per-session revoke call (same reason sessionsInvalidatedAt above
    // exists as a global-cutoff workaround rather than a native one). The
    // client attaches its stable per-install session id as this header;
    // requests without it (older app builds, or web, which doesn't have this
    // concept) simply skip the check — graceful degradation, not a crash.
    const sessionId = req.headers['x-session-id'] || null;
    req.sessionId = sessionId;
    req.currentSession = null;
    if (sessionId) {
      try {
        req.currentSession = await db.getSessionBySessionId(req.userId, sessionId);
      } catch (err) {
        // Degrades to "session tracking unavailable" (same as sending no
        // header at all) rather than 500ing every request in this app —
        // e.g. 0022_sessions.sql not yet manually applied (see that
        // migration's own comment on why this can't be applied automatically
        // in this environment).
        if (!db.isMissingTableError(err)) throw err;
      }
      if (req.currentSession?.revokedAt) {
        securityLog('device_session_revoked_token_rejected', { userId: req.userId, path: req.path });
        return res.status(401).json({ error: 'session_revoked' });
      }
    }
    // Email-OTP 2FA step-up gate (see 0023_two_factor_codes.sql) — enforced
    // here, not just in the UI, so a raw first-factor JWT can't bypass it.
    // Uses a distinct 403 (not the blanket 401 above) specifically so the
    // mobile app's "any 401 forces sign-out" interceptor doesn't bounce an
    // otherwise-valid, mid-2FA session back to the login screen instead of
    // an OTP-entry screen. Exempted paths: the 2FA endpoints themselves (or
    // verification could never complete), /api/me (needed to discover
    // twoFactorEnabled right after login, before a session row may even
    // exist yet), /api/login-events (registers the session row this gate
    // depends on), and /api/health.
    const TWO_FACTOR_EXEMPT_PREFIXES = ['/api/2fa/', '/api/me', '/api/login-events', '/api/health'];
    if (
      req.userData.twoFactorEnabled &&
      req.currentSession &&
      !req.currentSession.twoFactorVerifiedAt &&
      !TWO_FACTOR_EXEMPT_PREFIXES.some((p) => req.path.startsWith(p))
    ) {
      return res.status(403).json({ error: 'two_factor_required' });
    }

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAuth };
