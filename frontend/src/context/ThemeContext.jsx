import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { scopedKey } from '../lib/userScope.js';

const ThemeContext = createContext(null);
const THEME_KEY = 'wallet_theme';

function readStoredTheme() {
  const stored = localStorage.getItem(scopedKey(THEME_KEY));
  // Light is always the default for a first-time visitor — deliberately
  // ignoring the OS/browser color-scheme preference, unlike most apps.
  return stored === 'dark' ? 'dark' : 'light';
}

export function ThemeProvider({ children }) {
  const { userId } = useAuth();
  const [theme, setThemeState] = useState(readStoredTheme);

  // The app never full-reloads on login/logout, so a switched-in user's own
  // saved theme (scoped per-user, see lib/userScope.js) must be re-read here
  // explicitly rather than relying on the lazy useState initializer above.
  useEffect(() => {
    setThemeState(readStoredTheme());
  }, [userId]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(scopedKey(THEME_KEY), theme);
    // Also mirror to the unscoped key: index.html's pre-hydration inline
    // script reads it synchronously (before React/auth ever runs) purely to
    // paint the right theme with zero flash. It's never treated as
    // authoritative here — the effect above always re-derives the real
    // per-user theme from the scoped key on every mount/user change.
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* storage unavailable */ }
  }, [theme]);

  const setTheme = useCallback((next) => setThemeState(next), []);
  const toggleTheme = useCallback(() => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')), []);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme, isDark: theme === 'dark' }),
    [theme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
