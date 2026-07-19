import { describe, it, expect } from 'vitest';
import { isPasswordValid, passwordValidationError } from '../passwordValidation.js';

describe('isPasswordValid', () => {
  it('returns true for a 6+ char password that matches confirm', () => {
    expect(isPasswordValid('secret', 'secret')).toBe(true);
  });

  it('returns true for a longer matching password', () => {
    expect(isPasswordValid('a-very-long-password', 'a-very-long-password')).toBe(true);
  });

  it('returns false when password is shorter than 6 characters', () => {
    expect(isPasswordValid('abc12', 'abc12')).toBe(false);
  });

  it('returns false when password and confirm do not match', () => {
    expect(isPasswordValid('secret', 'secrets')).toBe(false);
  });

  it('returns false for empty password and confirm', () => {
    expect(isPasswordValid('', '')).toBe(false);
  });

  it('treats exactly 6 characters as valid (boundary)', () => {
    expect(isPasswordValid('123456', '123456')).toBe(true);
  });
});

describe('passwordValidationError', () => {
  it('returns the length error when password is too short', () => {
    expect(passwordValidationError('abc', 'abc')).toBe('Password must be at least 6 characters.');
  });

  it('returns the length error even if confirm also matches but is short', () => {
    expect(passwordValidationError('', '')).toBe('Password must be at least 6 characters.');
  });

  it('returns the mismatch error when long enough but not matching', () => {
    expect(passwordValidationError('secret1', 'secret2')).toBe('Passwords do not match.');
  });

  it('prioritizes the length error over the mismatch error', () => {
    // Password too short AND mismatched — length check runs first.
    expect(passwordValidationError('ab', 'abc')).toBe('Password must be at least 6 characters.');
  });

  it('returns empty string when password is valid', () => {
    expect(passwordValidationError('secret', 'secret')).toBe('');
  });
});
