import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { readPrefs, writePrefs, DEFAULT_PREFS } from '../lib/preferences.js';
import { api } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';

const PreferencesContext = createContext(null);

// Best-effort push of the location/currency slice of preferences onto the
// backend profile. Without this, `profiles.currency`/`currency_symbol`/
// `country` never leave the schema default (India/INR) for ANY user — this
// stuff has always lived only in this browser's localStorage, and nothing
// used to sync it. The admin panel's User grid and dashboard charts read
// the backend column, not localStorage, so a stale/never-synced value there
// shows up as flatly wrong (e.g. a USD/USA user displaying as INR/India).
function syncProfileFields(p) {
  api.patch('/me', { country: p.country, currency: p.currency, currencySymbol: p.currencySymbol }).catch(() => {});
}

export function PreferencesProvider({ children }) {
  const { userId } = useAuth();
  const [prefs, setPrefsState] = useState(() => readPrefs());

  // The app never full-reloads on login/logout, so a switched-in user's
  // preferences (currency, language, auto-logout, etc.) must be reloaded
  // here explicitly — readPrefs()/writePrefs() are already scoped to the
  // current user (see lib/userScope.js), but this state won't pick that up
  // on its own once mounted. Also re-syncs to the backend on every login —
  // the one mechanism that retroactively fixes accounts whose real
  // preference was already sitting in localStorage from before this sync
  // existed, without requiring them to revisit Settings.
  useEffect(() => {
    const next = readPrefs();
    setPrefsState(next);
    if (userId) syncProfileFields(next);
  }, [userId]);

  const setPrefs = useCallback((next) => {
    setPrefsState((prev) => {
      const merged = typeof next === 'function' ? next(prev) : { ...prev, ...next };
      writePrefs(merged);
      if (userId) syncProfileFields(merged);
      return merged;
    });
  }, [userId]);

  const resetPrefs = useCallback(() => {
    writePrefs(DEFAULT_PREFS);
    setPrefsState({ ...DEFAULT_PREFS });
  }, []);

  const value = useMemo(() => ({ prefs, setPrefs, resetPrefs }), [prefs, setPrefs, resetPrefs]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within a PreferencesProvider');
  return ctx;
}
