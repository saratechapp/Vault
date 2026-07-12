import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, REMEMBER_ME_KEY } from '../lib/supabaseClient.js';
import { api } from '../lib/api.js';
import { touchActivity, clearActivity, isIdleExpired, markSessionExpired } from '../lib/idleSession.js';
import { setCurrentUserId } from '../lib/userScope.js';
import { consumeImpersonationEntry } from '../lib/impersonation.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  // Has /api/me resolved (successfully or not) for the *current* session?
  // Distinct from `user` itself being non-null, so a page can tell "still
  // loading" apart from "loaded, and there's genuinely no profile".
  const [userLoaded, setUserLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Runs on every app boot / full page reload (browser reopened after
    // sleep, restart, or shutdown). The JS idle timer below only tracks time
    // while the tab is alive, so this is the check that catches "PC was off
    // for a day" — it compares the persisted last-activity timestamp against
    // real elapsed time before ever trusting a cached, possibly stale session.
    supabase.auth.getSession().then(async ({ data }) => {
      let activeSession = data.session;
      // Scope storage to this (possibly returning) user before anything below
      // reads a user-scoped key (isIdleExpired reads the auto-logout prefs).
      setCurrentUserId(activeSession?.user?.id ?? null);
      if (activeSession && isIdleExpired()) {
        markSessionExpired();
        await supabase.auth.signOut();
        clearActivity();
        activeSession = null;
        setCurrentUserId(null);
      } else if (activeSession) {
        touchActivity();
      }
      if (cancelled) return;
      setSession(activeSession);
      setSessionReady(true);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((event, newSession) => {
      setCurrentUserId(newSession?.user?.id ?? null);
      if (newSession) touchActivity();
      // 'SIGNED_IN' only fires on a genuine new sign-in (password, OAuth
      // redirect landing, magic-link/impersonation entry) — restoring an
      // already-persisted session on boot fires 'INITIAL_SESSION' instead,
      // and 'TOKEN_REFRESHED' is excluded by only matching this one event.
      if (event === 'SIGNED_IN' && newSession) {
        const method = consumeImpersonationEntry()
          ? 'impersonation'
          : newSession.user?.app_metadata?.provider === 'google' ? 'google' : 'password';
        api.post('/login-events', { method }).catch(() => {
          // best-effort — never block sign-in on this
        });
      }
      setSession(newSession);
    });
    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  // Refresh the profile (plan, hasPassword, etc.) from the server so it
  // can't drift from — or be spoofed via — a locally cached copy.
  useEffect(() => {
    if (!session) {
      setUser(null);
      setUserLoaded(false);
      return;
    }
    let cancelled = false;
    api
      .get('/me')
      .then((fresh) => {
        if (cancelled) return;
        // GET /api/me responds { user: {...} } (unlike PATCH /api/me, which
        // returns the profile object unwrapped) — must unwrap here too.
        if (fresh?.user) setUser(fresh.user);
      })
      .catch(() => {
        // handled globally by the 401 interceptor in lib/api.js
      })
      .finally(() => {
        if (!cancelled) setUserLoaded(true);
      });
    return () => { cancelled = true; };
  }, [session]);

  // Whether this account can log in with a password comes from our own
  // profiles.has_password column (see backend POST /api/me/password-set) —
  // deliberately NOT derived from Supabase's identities/AMR data. Both were
  // tried and both proved unreliable: updateUser({password}) doesn't
  // consistently add an 'email' identity, and the session's auth-method
  // claim only updates on a *fresh* password sign-in, not when a password is
  // merely added mid-session — so neither survived a page refresh correctly.
  const needsPassword = !!session && userLoaded && user !== null && !user.hasPassword;
  const ready = sessionReady && (!session || userLoaded);

  // Persisted before calling loginWithPassword/loginWithOAuth so the *next*
  // page load's supabaseClient picks the right storage (see lib/supabaseClient.js
  // for why this can't take effect mid-session).
  const setRememberMe = useCallback((value) => {
    localStorage.setItem(REMEMBER_ME_KEY, String(!!value));
  }, []);

  // Redirect-based OAuth (Google/Apple/Facebook) — the browser navigates away
  // to the provider's consent screen and back; there's no session to return
  // here synchronously. onAuthStateChange (above) picks up the session once
  // the browser lands back on redirectTo. Supabase links this identity to an
  // existing account automatically when the email is already registered and
  // verified on both sides (project setting — see CLAUDE.md notes).
  const loginWithOAuth = useCallback(async (provider) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/signup` },
    });
    if (error) throw new Error(error.message);
  }, []);

  // Password login — only works once the account has a password set (see
  // setAccountPassword below).
  const loginWithPassword = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    // Self-healing backfill: a successful password login is itself proof a
    // password exists, regardless of how/when it was originally set — makes
    // sure our own record agrees, for any account that predates this flag.
    // Awaited *before* setSession (which triggers the /api/me refetch above)
    // so that refetch can't win the race and read a stale hasPassword=false.
    try {
      await api.post('/me/password-set');
    } catch {
      // best-effort; worst case needsPassword briefly reads stale until the
      // next successful login
    }
    setSession(data.session);
    return data.user;
  }, []);

  // Lets an already-signed-in user (however they got in) attach a password
  // to their account — the mandatory step right after first OAuth signup,
  // or a voluntary "set/change password" from Settings later.
  const setAccountPassword = useCallback(async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(error.message);
    await api.post('/me/password-set');
    // No session change happens here (same session continues), so nothing
    // else would trigger a /api/me refetch — update local state directly.
    setUser((u) => (u ? { ...u, hasPassword: true } : u));
  }, []);

  // Emails a reset link (Forgot Password). The link lands on /reset-password,
  // which establishes a temporary recovery session and lets them set a new one.
  const sendPasswordReset = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw new Error(error.message);
  }, []);

  const logout = useCallback(async ({ reason } = {}) => {
    if (reason === 'idle') markSessionExpired();
    await supabase.auth.signOut();
    clearActivity();
    setCurrentUserId(null);
    setSession(null);
    setUser(null);
  }, []);

  // Ends the active admin-issued impersonation session server-side (marks
  // impersonation_sessions.ended_at) then signs out — ending the row alone
  // can't invalidate the already-issued Supabase JWT, so both steps are
  // needed. Lands the browser back on /login as itself, not as the
  // impersonated user.
  const exitImpersonation = useCallback(async () => {
    try {
      await api.post('/impersonation/end');
    } catch {
      // best-effort — still sign out below even if the end-call fails
    }
    await logout();
  }, [logout]);

  // Raw auth id, available the instant Supabase resolves the session — well
  // before the /api/me profile fetch above completes. Theme/PreferencesContext
  // key their per-user storage off this so a switched-in user's settings load
  // as early as possible instead of waiting on the profile round-trip.
  const userId = session?.user?.id || null;
  // Set by buildSafeUser (backend) whenever an admin currently has an active
  // impersonation session against this account — drives ImpersonationBanner.
  const impersonation = user?.impersonation || null;

  const value = useMemo(
    () => ({
      user, userId, isAuthed: !!session, ready, needsPassword, impersonation,
      loginWithOAuth, loginWithPassword, setAccountPassword, sendPasswordReset, setRememberMe,
      logout, exitImpersonation, setUser,
    }),
    [user, userId, session, ready, needsPassword, impersonation, loginWithOAuth, loginWithPassword, setAccountPassword, sendPasswordReset, setRememberMe, logout, exitImpersonation]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
