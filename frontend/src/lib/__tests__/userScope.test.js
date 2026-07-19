// userScope.js keeps currentUserId as mutable module-level state (a
// singleton), not per-instance state — so a value set by one test would
// otherwise leak into every test that runs after it in the same module
// instance. We force a fresh module instance per test via vi.resetModules()
// + a dynamic import, so each test starts from currentUserId === null.
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('userScope', () => {
  let setCurrentUserId;
  let getCurrentUserId;
  let scopedKey;

  beforeEach(async () => {
    vi.resetModules();
    ({ setCurrentUserId, getCurrentUserId, scopedKey } = await import('../userScope.js'));
  });

  it('getCurrentUserId is null before any user is set', () => {
    expect(getCurrentUserId()).toBeNull();
  });

  it('scopedKey returns the bare key when no user is set', () => {
    expect(scopedKey('wallet_prefs_v1')).toBe('wallet_prefs_v1');
  });

  it('setCurrentUserId stores the id and getCurrentUserId returns it', () => {
    setCurrentUserId('user-123');
    expect(getCurrentUserId()).toBe('user-123');
  });

  it('scopedKey namespaces the key by the current user once set', () => {
    setCurrentUserId('user-123');
    expect(scopedKey('wallet_prefs_v1')).toBe('wallet_prefs_v1::user-123');
  });

  it('setCurrentUserId(null) clears back to the unscoped key', () => {
    setCurrentUserId('user-123');
    setCurrentUserId(null);
    expect(getCurrentUserId()).toBeNull();
    expect(scopedKey('wallet_prefs_v1')).toBe('wallet_prefs_v1');
  });

  it('setCurrentUserId falls back to null for a falsy id (e.g. empty string)', () => {
    setCurrentUserId('user-123');
    setCurrentUserId('');
    expect(getCurrentUserId()).toBeNull();
  });

  it('does not leak user id across module instances (sanity check of reset pattern)', () => {
    // No setCurrentUserId call in this test — if the reset pattern above
    // weren't working, a previous test's 'user-123' would still be present.
    expect(getCurrentUserId()).toBeNull();
  });
});
