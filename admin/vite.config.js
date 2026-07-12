import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Served under /superadmin/ so the consumer app's dev server (frontend/
  // vite.config.js) can transparently proxy that one path prefix here —
  // one memorable URL (localhost:5173/superadmin) instead of a second port,
  // without merging the two apps' bundles (still separate MUI/Tailwind
  // stacks — see the plan doc for why that split exists). In production
  // this same split needs a matching reverse-proxy rule: route
  // /superadmin/* to wherever this app's static build is hosted, and
  // everything else to the consumer app.
  base: '/superadmin/',
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
