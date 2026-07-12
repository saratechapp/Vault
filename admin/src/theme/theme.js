import { createTheme } from '@mui/material/styles';

// Kept in sync with tokens.scss by hand (see that file's header comment).
const PALETTE = {
  light: {
    brand: '#7f3aef', brandStrong: '#651fd6',
    bg: '#f6f5fa', surface: '#ffffff', surface2: '#f1f0f7', border: '#e3e1ee',
    text: '#17151f', textMuted: '#625f74',
    success: '#16a34a', warning: '#d97706', danger: '#dc2626',
  },
  dark: {
    brand: '#9d67f4', brandStrong: '#bf9bf8',
    bg: '#0f0e17', surface: '#17151f', surface2: '#1e1b2b', border: '#2a2738',
    text: '#f1f0f7', textMuted: '#a39fb8',
    success: '#22c55e', warning: '#f59e0b', danger: '#f87171',
  },
};

export function buildTheme(mode) {
  const p = PALETTE[mode] || PALETTE.light;
  return createTheme({
    palette: {
      mode,
      primary: { main: p.brand, dark: p.brandStrong },
      success: { main: p.success },
      warning: { main: p.warning },
      error: { main: p.danger },
      background: { default: p.bg, paper: p.surface },
      text: { primary: p.text, secondary: p.textMuted },
      divider: p.border,
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      h1: { fontWeight: 700 }, h2: { fontWeight: 700 }, h3: { fontWeight: 700 },
      h4: { fontWeight: 700 }, h5: { fontWeight: 600 }, h6: { fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiAppBar: { styleOverrides: { root: { boxShadow: 'none', borderBottom: `1px solid ${p.border}` } } },
      MuiDrawer: { styleOverrides: { paper: { borderRight: `1px solid ${p.border}` } } },
      MuiCard: { styleOverrides: { root: { border: `1px solid ${p.border}`, boxShadow: 'none' } } },
      MuiButton: { styleOverrides: { root: { borderRadius: 8 } } },
      MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
    },
  });
}

export default buildTheme;
