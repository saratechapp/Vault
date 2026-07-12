import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readPrefs, writePrefs, getCurrencyMeta, DEFAULT_PREFS, CURRENCIES } from '../preferences.js';

function stubLanguage(lang, languages) {
  Object.defineProperty(navigator, 'language', { value: lang, configurable: true });
  Object.defineProperty(navigator, 'languages', { value: languages || [lang], configurable: true });
}

describe('preferences', () => {
  const originalLanguage = navigator.language;
  const originalLanguages = navigator.languages;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'language', { value: originalLanguage, configurable: true });
    Object.defineProperty(navigator, 'languages', { value: originalLanguages, configurable: true });
  });

  describe('writePrefs / readPrefs', () => {
    it('persists and reads back a written preferences object', () => {
      writePrefs({ ...DEFAULT_PREFS, currency: 'GBP', country: 'GB' });
      const prefs = readPrefs();
      expect(prefs.currency).toBe('GBP');
      expect(prefs.country).toBe('GB');
    });

    it('merges stored prefs with DEFAULT_PREFS for missing keys', () => {
      localStorage.setItem('wallet_prefs_v1', JSON.stringify({ currency: 'EUR' }));
      const prefs = readPrefs();
      expect(prefs.currency).toBe('EUR');
      expect(prefs.language).toBe(DEFAULT_PREFS.language);
      expect(prefs.dateFormat).toBe(DEFAULT_PREFS.dateFormat);
    });

    it('auto-detects and persists prefs on first-ever read when nothing is stored', () => {
      stubLanguage('en-GB', ['en-GB']);
      expect(localStorage.getItem('wallet_prefs_v1')).toBeNull();

      const prefs = readPrefs();
      expect(prefs.country).toBe('GB');
      expect(prefs.currency).toBe('GBP');
      expect(prefs.timezone).toBe('Europe/London');

      // Persisted so a second read doesn't need to re-detect.
      const stored = JSON.parse(localStorage.getItem('wallet_prefs_v1'));
      expect(stored.country).toBe('GB');
    });

    it('falls back to DEFAULT_PREFS when locale region matches no known country', () => {
      stubLanguage('xx-ZZ', ['xx-ZZ']);
      const prefs = readPrefs();
      expect(prefs.country).toBe(DEFAULT_PREFS.country);
      expect(prefs.currency).toBe(DEFAULT_PREFS.currency);
    });

    it('does not re-detect once a preferences record already exists', () => {
      writePrefs({ ...DEFAULT_PREFS, currency: 'JPY', country: 'JP' });
      stubLanguage('en-GB', ['en-GB']);
      const prefs = readPrefs();
      expect(prefs.currency).toBe('JPY');
      expect(prefs.country).toBe('JP');
    });

    it('returns DEFAULT_PREFS when localStorage.getItem throws', () => {
      const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('storage unavailable');
      });
      const prefs = readPrefs();
      expect(prefs).toEqual({ ...DEFAULT_PREFS });
      spy.mockRestore();
    });
  });

  describe('getCurrencyMeta', () => {
    it('returns the matching currency metadata for a known code', () => {
      const meta = getCurrencyMeta('EUR');
      expect(meta).toEqual(CURRENCIES.find((c) => c.code === 'EUR'));
      expect(meta.symbol).toBe('€');
    });

    it('falls back to USD for an unknown currency code', () => {
      const meta = getCurrencyMeta('ZZZ');
      expect(meta.code).toBe('USD');
    });

    it('falls back to USD for undefined input', () => {
      const meta = getCurrencyMeta(undefined);
      expect(meta.code).toBe('USD');
    });
  });
});
