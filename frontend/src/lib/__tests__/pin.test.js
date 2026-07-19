// @vitest-environment node
//
// jsdom (the default test environment for this project) does not implement
// crypto.subtle, which pin.js relies on for SHA-256 hashing. Switching this
// file to Node's environment gives us native Web Crypto, but Node has no
// localStorage/sessionStorage — so we polyfill minimal in-memory stand-ins
// below and assign them to globalThis before each test.
import { describe, it, expect, beforeEach } from 'vitest';
import { hasPin, setPin, verifyPin, removePin, isUnlocked, lockNow } from '../pin.js';

function createMemoryStorage() {
  let store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

beforeEach(() => {
  globalThis.localStorage = createMemoryStorage();
  globalThis.sessionStorage = createMemoryStorage();
});

describe('pin', () => {
  it('reports no pin set initially', () => {
    expect(hasPin()).toBe(false);
  });

  it('setPin creates a pin and marks the session unlocked', async () => {
    await setPin('1234');
    expect(hasPin()).toBe(true);
    expect(isUnlocked()).toBe(true);
  });

  it('verifyPin returns true for the correct pin', async () => {
    await setPin('1234');
    await expect(verifyPin('1234')).resolves.toBe(true);
  });

  it('verifyPin returns false for an incorrect pin', async () => {
    await setPin('1234');
    await expect(verifyPin('9999')).resolves.toBe(false);
  });

  it('verifyPin returns false when no pin has been set', async () => {
    await expect(verifyPin('1234')).resolves.toBe(false);
  });

  it('removePin clears the pin and the unlocked flag', async () => {
    await setPin('1234');
    expect(hasPin()).toBe(true);
    removePin();
    expect(hasPin()).toBe(false);
    expect(isUnlocked()).toBe(false);
  });

  it('lockNow clears the unlocked flag without removing the pin', async () => {
    await setPin('1234');
    expect(isUnlocked()).toBe(true);
    lockNow();
    expect(isUnlocked()).toBe(false);
    expect(hasPin()).toBe(true);
  });

  it('isUnlocked is false before any pin has ever been set or verified', () => {
    expect(isUnlocked()).toBe(false);
  });

  it('verifyPin re-unlocks the session after lockNow', async () => {
    await setPin('1234');
    lockNow();
    expect(isUnlocked()).toBe(false);
    await verifyPin('1234');
    expect(isUnlocked()).toBe(true);
  });

  it('a failed verifyPin does not unlock the session', async () => {
    await setPin('1234');
    lockNow();
    await verifyPin('wrong');
    expect(isUnlocked()).toBe(false);
  });
});
