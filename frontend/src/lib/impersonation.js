// A one-shot sessionStorage flag set by ImpersonateEntry.jsx just before it
// establishes the target user's session, so AuthContext's onAuthStateChange
// handler can tag the resulting login-event as method:'impersonation'
// instead of guessing password/google from the session's auth provider.
const FLAG_KEY = 'wallet_impersonation_entry';

export function markImpersonationEntry() {
  try {
    sessionStorage.setItem(FLAG_KEY, '1');
  } catch {
    // storage unavailable — falls back to a normal password/google label
  }
}

// Read-and-clear: only ever consumed once, by the very next SIGNED_IN event.
export function consumeImpersonationEntry() {
  try {
    const wasSet = sessionStorage.getItem(FLAG_KEY) === '1';
    sessionStorage.removeItem(FLAG_KEY);
    return wasSet;
  } catch {
    return false;
  }
}
