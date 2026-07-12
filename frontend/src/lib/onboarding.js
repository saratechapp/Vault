// First-time product tour completion — keyed per user id so a shared browser
// (or a second account signing in later) doesn't inherit someone else's
// "already seen it" state. Same localStorage-preference pattern as the rest
// of the app (see lib/preferences.js, lib/pin.js).
const KEY_PREFIX = 'wallet_onboarding_completed_';

export function isOnboardingCompleted(userId) {
  if (!userId) return true; // unknown user yet — don't show anything prematurely
  try {
    return localStorage.getItem(KEY_PREFIX + userId) === '1';
  } catch {
    return true;
  }
}

export function markOnboardingCompleted(userId) {
  if (!userId) return;
  try {
    localStorage.setItem(KEY_PREFIX + userId, '1');
  } catch {
    // storage unavailable — worst case the tour reappears next session
  }
}

// One-shot "you just finished/skipped the tour, now create an account"
// banner flag. sessionStorage (not localStorage) since it only needs to
// survive the single redirect to /app/accounts, not future visits — same
// peek/clear split as lib/idleSession.js's expired-session flag, which
// avoids a React 18 StrictMode double-invoke bug where a combined
// read-and-clear on mount clears itself before the second dev-only effect
// run reads it.
const CREATE_ACCOUNT_PROMPT_KEY = 'wallet_prompt_create_account';

export function promptCreateAccountOnNextVisit() {
  try {
    sessionStorage.setItem(CREATE_ACCOUNT_PROMPT_KEY, '1');
  } catch {
    // storage unavailable
  }
}

export function peekCreateAccountPrompt() {
  try {
    return sessionStorage.getItem(CREATE_ACCOUNT_PROMPT_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearCreateAccountPrompt() {
  try {
    sessionStorage.removeItem(CREATE_ACCOUNT_PROMPT_KEY);
  } catch {
    // storage unavailable
  }
}
