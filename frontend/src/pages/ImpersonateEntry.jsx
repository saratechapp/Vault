import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { markImpersonationEntry } from '../lib/impersonation.js';

// Landing point for the magic link an admin opens to "Login As User" (see
// backend/routes/admin/users.js POST /:id/impersonate). The Supabase client
// (frontend/src/lib/supabaseClient.js, detectSessionInUrl: true by default)
// auto-establishes the target user's real session from the link's URL hash
// — this page just marks the login-event as an impersonation entry (best-
// effort; see lib/impersonation.js for the race this can lose) and waits
// for that session to land before redirecting into the app.
export default function ImpersonateEntry() {
  const navigate = useNavigate();
  const { isAuthed, ready } = useAuth();
  const [timedOut, setTimedOut] = useState(false);
  const markedRef = useRef(false);

  if (!markedRef.current) {
    markImpersonationEntry();
    markedRef.current = true;
  }

  useEffect(() => {
    if (ready && isAuthed) navigate('/app/dashboard', { replace: true });
  }, [ready, isAuthed, navigate]);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 10000);
    return () => clearTimeout(t);
  }, []);

  if (timedOut && !isAuthed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-app px-4 text-center">
        <p className="text-lg font-semibold text-fg">This link has expired or already been used.</p>
        <p className="text-sm text-muted">Ask the admin to start a new impersonation session.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-app">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand-500" />
    </div>
  );
}
