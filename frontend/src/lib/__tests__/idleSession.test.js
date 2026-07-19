import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  touchActivity,
  clearActivity,
  isIdleExpired,
  markSessionExpired,
  peekSessionExpiredFlag,
  clearSessionExpiredFlag,
  markAccountSuspended,
  peekAccountSuspendedFlag,
  clearAccountSuspendedFlag,
} from '../idleSession.js';
import { writePrefs, DEFAULT_PREFS } from '../preferences.js';

describe('idleSession', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-12T10:00:00Z'));
    // readPrefs() auto-detects/persists on first read if nothing is stored;
    // pin the auto-logout config explicitly so tests don't depend on that.
    writePrefs({ ...DEFAULT_PREFS, autoLogoutEnabled: true, autoLogoutIdleMinutes: 15 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('touchActivity / clearActivity / isIdleExpired', () => {
    it('is not idle-expired when no activity has ever been recorded', () => {
      expect(isIdleExpired()).toBe(false);
    });

    it('is not idle-expired immediately after touchActivity', () => {
      touchActivity();
      expect(isIdleExpired()).toBe(false);
    });

    it('becomes idle-expired once more time than the idle window has elapsed', () => {
      touchActivity();
      vi.setSystemTime(new Date('2026-07-12T10:16:00Z')); // +16 minutes > 15 min threshold
      expect(isIdleExpired()).toBe(true);
    });

    it('is not idle-expired just under the idle window', () => {
      touchActivity();
      vi.setSystemTime(new Date('2026-07-12T10:14:00Z')); // +14 minutes < 15 min threshold
      expect(isIdleExpired()).toBe(false);
    });

    it('clearActivity resets the last-activity timestamp so isIdleExpired is false again', () => {
      touchActivity();
      vi.setSystemTime(new Date('2026-07-12T10:16:00Z'));
      expect(isIdleExpired()).toBe(true);
      clearActivity();
      expect(isIdleExpired()).toBe(false);
    });

    it('is never idle-expired when autoLogoutEnabled is false', () => {
      writePrefs({ ...DEFAULT_PREFS, autoLogoutEnabled: false, autoLogoutIdleMinutes: 15 });
      touchActivity();
      vi.setSystemTime(new Date('2026-07-12T12:00:00Z'));
      expect(isIdleExpired()).toBe(false);
    });

    it('respects a custom autoLogoutIdleMinutes value', () => {
      writePrefs({ ...DEFAULT_PREFS, autoLogoutEnabled: true, autoLogoutIdleMinutes: 5 });
      touchActivity();
      vi.setSystemTime(new Date('2026-07-12T10:06:01Z')); // +6m1s > 5 min threshold
      expect(isIdleExpired()).toBe(true);
    });

    it('enforces a minimum idle window of 60 seconds even for a tiny configured value', () => {
      // 0.5 minutes (30s) is truthy so it isn't swallowed by the `|| 15`
      // fallback in idleDurationMs(), but 30s is below the enforced 60s floor.
      writePrefs({ ...DEFAULT_PREFS, autoLogoutEnabled: true, autoLogoutIdleMinutes: 0.5 });
      touchActivity();
      vi.setSystemTime(new Date('2026-07-12T10:00:30Z')); // +30s < enforced 60s minimum
      expect(isIdleExpired()).toBe(false);
      vi.setSystemTime(new Date('2026-07-12T10:01:01Z')); // +61s > enforced 60s minimum
      expect(isIdleExpired()).toBe(true);
    });
  });

  describe('session-expired flag', () => {
    it('peekSessionExpiredFlag is false when never set', () => {
      expect(peekSessionExpiredFlag()).toBe(false);
    });

    it('markSessionExpired sets the flag, peek reads it, clear removes it', () => {
      markSessionExpired();
      expect(peekSessionExpiredFlag()).toBe(true);
      clearSessionExpiredFlag();
      expect(peekSessionExpiredFlag()).toBe(false);
    });

    it('peek is safe to call multiple times without clearing the flag itself', () => {
      markSessionExpired();
      expect(peekSessionExpiredFlag()).toBe(true);
      expect(peekSessionExpiredFlag()).toBe(true);
    });
  });

  describe('account-suspended flag', () => {
    it('peekAccountSuspendedFlag is false when never set', () => {
      expect(peekAccountSuspendedFlag()).toBe(false);
    });

    it('markAccountSuspended sets the flag, peek reads it, clear removes it', () => {
      markAccountSuspended();
      expect(peekAccountSuspendedFlag()).toBe(true);
      clearAccountSuspendedFlag();
      expect(peekAccountSuspendedFlag()).toBe(false);
    });
  });
});
