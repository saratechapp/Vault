import { describe, it, expect, beforeEach } from 'vitest';
import { markImpersonationEntry, consumeImpersonationEntry } from '../impersonation.js';

describe('impersonation entry flag', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('consumeImpersonationEntry returns false when never marked', () => {
    expect(consumeImpersonationEntry()).toBe(false);
  });

  it('markImpersonationEntry sets the flag so the next consume returns true', () => {
    markImpersonationEntry();
    expect(consumeImpersonationEntry()).toBe(true);
  });

  it('consume clears the flag — a second consecutive call returns false', () => {
    markImpersonationEntry();
    expect(consumeImpersonationEntry()).toBe(true);
    expect(consumeImpersonationEntry()).toBe(false);
  });

  it('marking again after a consume works for the next login event', () => {
    markImpersonationEntry();
    consumeImpersonationEntry();
    markImpersonationEntry();
    expect(consumeImpersonationEntry()).toBe(true);
  });
});
