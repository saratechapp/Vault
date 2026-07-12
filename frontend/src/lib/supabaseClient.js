import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — see frontend/.env.example.');
}

// "Remember me" on the Login page: this flag (itself just a non-secret
// preference, not the session) decides which storage the auth session is
// kept in. Read once at module load, so a choice made during login takes
// effect starting with that page's session and persists from then on;
// localStorage survives browser restarts, sessionStorage clears on tab close.
export const REMEMBER_ME_KEY = 'wallet_remember_me';
const rememberMe = localStorage.getItem(REMEMBER_ME_KEY) !== 'false';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: rememberMe ? window.localStorage : window.sessionStorage,
    // Distinct from admin/src/lib/supabaseClient.js's key — both apps now
    // share an origin (the /superadmin dev proxy), and without this they'd
    // read/write the same session slot. Supabase's client serializes auth
    // operations per storage key across tabs; two independent GoTrueClient
    // instances contending for one key can leave a sign-in request waiting
    // on a lock the other tab never released, hanging indefinitely with no
    // error. Separate keys make the two apps' sessions fully independent.
    storageKey: 'wallet-consumer-auth',
  },
});
