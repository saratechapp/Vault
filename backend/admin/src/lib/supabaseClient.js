import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — see admin/.env.example.');
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
