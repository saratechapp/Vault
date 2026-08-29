import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Missing at build time -> createClient() below throws on import and the SPA
// white-screens with only a console error. Render a readable message instead
// so the cause is obvious (usually: backend/.env lacks VITE_SUPABASE_* and
// the admin bundle was rebuilt without them).
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  const msg =
    'Super Admin build is missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
    'Set them in backend/.env (same values as frontend/.env), then rebuild: ' +
    '`cd backend && npm run build` (or restart `npm run dev`).';
  // eslint-disable-next-line no-console
  console.error(msg);
  const el = typeof document !== 'undefined' && document.getElementById('root');
  if (el) {
    el.innerHTML =
      `<div style="font-family:system-ui;max-width:640px;margin:15vh auto;padding:24px;` +
      `border:1px solid #f0c;border-radius:12px;color:#333;line-height:1.5">` +
      `<h2 style="margin:0 0 8px">Super Admin can’t start</h2><p style="margin:0">${msg}</p></div>`;
  }
  throw new Error('missing_supabase_env');
}

// Same Supabase Auth project as the consumer app (frontend/src/lib/
// supabaseClient.js) — admin-ness is a row in the `admins` table, not a
// separate Auth realm (see the plan doc). Only the public anon key ships
// here; every privileged call happens server-side via the service-role key.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: window.localStorage,
    // Distinct from frontend/src/lib/supabaseClient.js's key — see that
    // file's comment. Keeps this app's session fully independent of the
    // consumer app's, even though both now run on the same origin via the
    // /superadmin dev proxy.
    storageKey: 'wallet-admin-auth',
  },
});
