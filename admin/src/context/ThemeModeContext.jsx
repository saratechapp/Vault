import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material';
import { buildTheme } from '../theme/theme.js';

const ThemeModeContext = createContext(null);
const THEME_KEY = 'wallet_admin_theme';

// Same light-is-default-for-a-first-time-visitor policy as the consumer
// app's ThemeContext.jsx, for consistency across both surfaces.
export function ThemeModeProvider({ children }) {
  const [mode, setMode] = useState(() => (localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'));

  useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark');
    localStorage.setItem(THEME_KEY, mode);
  }, [mode]);

  const toggleMode = useCallback(() => setMode((m) => (m === 'dark' ? 'light' : 'dark')), []);
  const muiTheme = useMemo(() => buildTheme(mode), [mode]);
  const value = useMemo(() => ({ mode, setMode, toggleMode }), [mode, toggleMode]);

  return (
    <ThemeModeContext.Provider value={value}>
      <MuiThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode() {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error('useThemeMode must be used within a ThemeModeProvider');
  return ctx;
}
