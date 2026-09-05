import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { getCurrencyMeta } from '../lib/preferences.js';

// Visitor-facing currency for the public marketing site (`/`) — deliberately
// separate from the signed-in app's own currency preference (preferences.js
// / PreferencesContext, key `wallet_prefs_v1`). Browsing the marketing site
// from a different country must never change a user's actual account
// currency, so this context owns its own storage keys and never touches
// readPrefs()/writePrefs().
//
// Backed by GET /api/public/pricing, which resolves the visitor's currency
// server-side (explicit choice -> saved choice, both handled here client-side
// -> CDN geo header -> browser locale -> admin default — see
// backend/src/services/currencyService.js) and returns the Super-Admin-
// configured price for every enabled currency in one call, so switching
// currency client-side is instant with no further network round-trip and no
// fabricated FX conversion — a currency only ever appears here if an admin
// has actually priced it.
const OVERRIDE_KEY = 'wallet_landing_currency_v1';
const CACHE_KEY = 'wallet_landing_pricing_v1';
const CACHE_TTL_MS = 10 * 60 * 1000;

function readOverride() {
  try {
    return localStorage.getItem(OVERRIDE_KEY) || null;
  } catch {
    return null;
  }
}
function writeOverride(code) {
  try {
    if (code) localStorage.setItem(OVERRIDE_KEY, code);
    else localStorage.removeItem(OVERRIDE_KEY);
  } catch {
    /* best-effort only */
  }
}

function readCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (raw && Date.now() - raw.fetchedAt < CACHE_TTL_MS) return raw.data;
  } catch {
    /* fall through to a fresh fetch */
  }
  return null;
}
function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, fetchedAt: Date.now() }));
  } catch {
    /* best-effort only */
  }
}

const FALLBACK_LOCALE = getCurrencyMeta('INR').locale;

const LandingCurrencyContext = createContext(null);

export function LandingCurrencyProvider({ children }) {
  const [data, setData] = useState(() => readCache());
  const [loading, setLoading] = useState(() => !readCache());
  const [override, setOverride] = useState(() => readOverride());

  // One request per page load (or per cache expiry) — never re-fetched just
  // because the visitor flips the selector, since the response already
  // carries every enabled currency's price.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const locale = (navigator.languages && navigator.languages[0]) || navigator.language || '';
        const res = await api.get(`/public/pricing?locale=${encodeURIComponent(locale)}`);
        if (cancelled) return;
        setData(res);
        writeCache(res);
      } catch {
        // Network/backend hiccup: whatever was cached (possibly nothing)
        // stays in place — formatCurrency below still works off the INR
        // fallback, so the page never shows undefined/NaN.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const currencies = data?.pricing?.currencies || [];
  const resolvedCode = data?.pricing?.currency || data?.pricing?.defaultCurrency || 'INR';
  // An explicit/saved override wins over the server's resolved currency, but
  // only while it's still one of the Super Admin's enabled currencies — if a
  // currency gets disabled later, a returning visitor falls back cleanly
  // instead of being stranded on a currency with no price.
  const currencyCode = (override && currencies.some((c) => c.code === override))
    ? override
    : resolvedCode;
  const selected = currencies.find((c) => c.code === currencyCode) || null;
  const locale = selected?.locale || FALLBACK_LOCALE;
  const symbol = selected?.symbol || getCurrencyMeta(currencyCode).symbol;

  const setCurrency = useCallback((code) => {
    setOverride(code);
    writeOverride(code);
  }, []);

  // For generic on-page amounts (dashboard-preview mock numbers, etc.) — NOT
  // for the subscription price itself, which should use `selected.monthly
  // Formatted` / `yearlyFormatted` directly since those are the exact
  // admin-configured, backend-formatted strings (single source of truth).
  const formatCurrency = useCallback((amount) => {
    const value = Number(amount) || 0;
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return `${symbol}${value.toFixed(2)}`;
    }
  }, [locale, currencyCode, symbol]);

  const value = useMemo(() => ({
    loading,
    currencyCode,
    currencySymbol: symbol,
    currencies,
    selected,
    source: data?.pricing?.source || 'default',
    trial: data?.trial || { enabled: false, durationMonths: 1 },
    enforcementEnabled: !!data?.enforcementEnabled,
    formatCurrency,
    setCurrency,
  }), [loading, currencyCode, symbol, currencies, selected, data, formatCurrency, setCurrency]);

  return <LandingCurrencyContext.Provider value={value}>{children}</LandingCurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(LandingCurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within a LandingCurrencyProvider');
  return ctx;
}
