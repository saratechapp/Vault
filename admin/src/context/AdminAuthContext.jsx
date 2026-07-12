import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { api } from '../lib/api.js';

const AdminAuthContext = createContext(null);

// Mirrors frontend/src/context/AuthContext.jsx's session -> profile-fetch
// shape, simplified: no idle timer, no OAuth, no password-set flow — none
// of those apply to a small, provisioned-only staff tool.
export function AdminAuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [admin, setAdmin] = useState(null);
  const [adminLoaded, setAdminLoaded] = useState(false);
  const [notAnAdmin, setNotAnAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setSessionReady(true);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setAdmin(null);
      setAdminLoaded(false);
      setNotAnAdmin(false);
      return;
    }
    let cancelled = false;
    api
      .get('/me')
      .then((fresh) => {
        if (cancelled) return;
        setAdmin(fresh);
      })
      .catch((err) => {
        if (cancelled) return;
        // A regular customer account (or a suspended admin) landing here —
        // distinct from a network/auth failure so the login screen can show
        // a clear reason instead of a generic error.
        if (err.message === 'not_an_admin' || err.message === 'admin_suspended') {
          setNotAnAdmin(true);
        }
      })
      .finally(() => {
        if (!cancelled) setAdminLoaded(true);
      });
    return () => { cancelled = true; };
  }, [session]);

  const loginWithPassword = useCallback(async (email, password) => {
    setNotAnAdmin(false);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    setSession(data.session);
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setAdmin(null);
  }, []);

  const ready = sessionReady && (!session || adminLoaded);
  const isAuthed = !!session && !!admin;

  const value = useMemo(
    () => ({ admin, isAuthed, ready, notAnAdmin, loginWithPassword, logout }),
    [admin, isAuthed, ready, notAnAdmin, loginWithPassword, logout]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  return ctx;
}
