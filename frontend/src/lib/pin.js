// PIN lock: SHA-256(salt + ':' + pin) via Web Crypto, stored in localStorage.
// The "unlocked" flag is session-scoped (sessionStorage) so it clears on tab close.
//
// Both keys are namespaced per signed-in user (see lib/userScope.js) — this
// is security-sensitive, not just a UX nicety: without scoping, one user
// setting a PIN silently overwrites another user's PIN on a shared browser,
// and a stale "unlocked" flag could let a newly logged-in user skip the PIN
// screen entirely.
import { scopedKey } from './userScope.js';

const PIN_KEY = 'wallet_pin_v1';
const UNLOCKED_KEY = 'wallet_pin_unlocked_v1';

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function digest(salt, pin) {
  const enc = new TextEncoder().encode(`${salt}:${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return bytesToHex(new Uint8Array(buf));
}

export function hasPin() {
  return !!localStorage.getItem(scopedKey(PIN_KEY));
}

export async function setPin(pin) {
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await digest(salt, pin);
  localStorage.setItem(scopedKey(PIN_KEY), JSON.stringify({ salt, hash, createdAt: new Date().toISOString() }));
  sessionStorage.setItem(scopedKey(UNLOCKED_KEY), '1');
}

export function removePin() {
  localStorage.removeItem(scopedKey(PIN_KEY));
  sessionStorage.removeItem(scopedKey(UNLOCKED_KEY));
}

export async function verifyPin(pin) {
  const raw = localStorage.getItem(scopedKey(PIN_KEY));
  if (!raw) return false;
  const { salt, hash } = JSON.parse(raw);
  const check = await digest(salt, pin);
  const ok = check === hash;
  if (ok) sessionStorage.setItem(scopedKey(UNLOCKED_KEY), '1');
  return ok;
}

export function isUnlocked() {
  return sessionStorage.getItem(scopedKey(UNLOCKED_KEY)) === '1';
}

export function lockNow() {
  sessionStorage.removeItem(scopedKey(UNLOCKED_KEY));
}
