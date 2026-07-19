import { describe, it, expect, beforeEach } from 'vitest';
import {
  isOnboardingCompleted,
  markOnboardingCompleted,
  promptCreateAccountOnNextVisit,
  peekCreateAccountPrompt,
  clearCreateAccountPrompt,
} from '../onboarding.js';

describe('onboarding completion', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns true (do not show tour) for an unknown/falsy userId', () => {
    expect(isOnboardingCompleted(null)).toBe(true);
    expect(isOnboardingCompleted(undefined)).toBe(true);
    expect(isOnboardingCompleted('')).toBe(true);
  });

  it('returns false for a user who has not completed onboarding yet', () => {
    expect(isOnboardingCompleted('user-1')).toBe(false);
  });

  it('markOnboardingCompleted flips isOnboardingCompleted to true for that user', () => {
    markOnboardingCompleted('user-1');
    expect(isOnboardingCompleted('user-1')).toBe(true);
  });

  it('is scoped per user id — completing for one user does not affect another', () => {
    markOnboardingCompleted('user-1');
    expect(isOnboardingCompleted('user-1')).toBe(true);
    expect(isOnboardingCompleted('user-2')).toBe(false);
  });

  it('markOnboardingCompleted is a no-op for a falsy userId', () => {
    markOnboardingCompleted(null);
    expect(localStorage.length).toBe(0);
  });
});

describe('create-account prompt flag', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('is false before it has ever been set', () => {
    expect(peekCreateAccountPrompt()).toBe(false);
  });

  it('promptCreateAccountOnNextVisit sets the flag and peek reads it', () => {
    promptCreateAccountOnNextVisit();
    expect(peekCreateAccountPrompt()).toBe(true);
  });

  it('clearCreateAccountPrompt removes the flag', () => {
    promptCreateAccountOnNextVisit();
    clearCreateAccountPrompt();
    expect(peekCreateAccountPrompt()).toBe(false);
  });

  it('peek does not itself clear the flag (read-and-clear is a separate step)', () => {
    promptCreateAccountOnNextVisit();
    expect(peekCreateAccountPrompt()).toBe(true);
    expect(peekCreateAccountPrompt()).toBe(true);
  });
});
