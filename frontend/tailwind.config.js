/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        app: 'rgb(var(--app) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        'surface-3': 'rgb(var(--surface-3) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        subtle: 'rgb(var(--subtle) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        'line-strong': 'rgb(var(--line-strong) / <alpha-value>)',
        tint: 'rgb(var(--tint) / <alpha-value>)',
        brand: {
          50: '#f6f0fe', 100: '#ede2fd', 200: '#dac6fb', 300: '#bf9bf8',
          400: '#9d67f4', 500: '#7F3AEF', 600: '#651fd6', 700: '#551fad',
          800: '#451d87', 900: '#371a66',
        },
        accent: {
          cyan: '#22d3ee', purple: '#a855f7', pink: '#ec4899', lime: '#84cc16',
          amber: '#f59e0b', rose: '#f43f5e', teal: '#14b8a6',
        },
        // Semantic, theme-aware (light/dark values differ — see index.css)
        // fintech tokens: money in/positive, caution, negative/destructive, informational.
        success: 'rgb(var(--success) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        info: 'rgb(var(--info) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        xs: '0 1px 2px -1px rgba(15,23,42,0.08)',
        sm: '0 2px 8px -2px rgba(15,23,42,0.12)',
        md: '0 8px 24px -8px rgba(15,23,42,0.18)',
        soft: '0 10px 40px -12px rgba(15,23,42,0.25)',
        lg: '0 20px 60px -16px rgba(15,23,42,0.35)',
        xl: '0 30px 90px -20px rgba(15,23,42,0.45)',
        glow: '0 0 60px -10px rgba(127,58,239,0.45)',
        card: '0 1px 0 rgb(var(--tint)/0.05) inset, 0 8px 30px -12px rgba(0,0,0,0.4)',
      },
      keyframes: {
        modalIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        modalPop: { from: { opacity: 0, transform: 'scale(0.96)' }, to: { opacity: 1, transform: 'scale(1)' } },
        viewIn: { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      },
      animation: {
        modalIn: 'modalIn 150ms ease-out',
        modalPop: 'modalPop 150ms ease-out',
        viewIn: 'viewIn 220ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
