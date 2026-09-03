import { describe, it, expect } from 'vitest';
import { isPasswordValid, passwordValidationError } from '../passwordValidation.js';

describe('isPasswordValid', () => {
  it('returns true for an 8+ char password that matches confirm', () => {
    expect(isPasswordValid('secret12', 'secret12')).toBe(true);
  });

  it('returns true for a longer matching password', () => {
    expect(isPasswordValid('a-very-long-password', 'a-very-long-password')).toBe(true);
  });

  it('returns false when password is shorter than 8 characters', () => {
    expect(isPasswordValid('abc123', 'abc123')).toBe(false);
  });

  it('returns false when password and confirm do not match', () => {
    expect(isPasswordValid('secret12', 'secret13')).toBe(false);
  });

  it('returns false for empty password and confirm', () => {
    expect(isPasswordValid('', '')).toBe(false);
  });

  it('treats exactly 8 characters as valid (boundary)', () => {
    expect(isPasswordValid('12ab34cd', '12ab34cd')).toBe(true);
  });

  it('rejects a trivially weak password (all one char / all digits)', () => {
    expect(isPasswordValid('aaaaaaaa', 'aaaaaaaa')).toBe(false);
    expect(isPasswordValid('12345678', '12345678')).toBe(false);
  });
});

describe('passwordValidationError', () => {
  it('returns the length error when password is too short', () => {
    expect(passwordValidationError('abc', 'abc')).toBe('Password must be at least 8 characters.');
  });

  it('returns the length error even if confirm also matches but is short', () => {
    expect(passwordValidationError('', '')).toBe('Password must be at least 8 characters.');
  });

  it('returns the weak-password error for a predictable string', () => {
    expect(passwordValidationError('12345678', '12345678')).toBe('Choose a less predictable password.');
  });

  it('returns the mismatch error when strong enough but not matching', () => {
    expect(passwordValidationError('secret1a', 'secret2b')).toBe('Passwords do not match.');
  });

  it('prioritizes the length error over the mismatch error', () => {
    expect(passwordValidationError('ab', 'abc')).toBe('Password must be at least 8 characters.');
  });

  it('returns empty string when password is valid', () => {
    expect(passwordValidationError('secret12', 'secret12')).toBe('');
  });
});
