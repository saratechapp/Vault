import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  // The admin app has no .env of its own (single-config goal — see
  // backend/.env.example). Point Vite's env loader at backend/ so
  // VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are read from backend/.env
  // regardless of how the build is invoked (scripts/dev.js, build-admin.js,
  // or a bare `vite build`). Without this a build with an unpopulated
  // process.env inlines empty strings and the SPA white-screens on
  // createClient('').
  envDir: path.resolve(rootDir, '..'),
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
  // Built to backend/admin/dist and served by the one backend server under
  // /superadmin (see backend/src/app.js). This must match main.jsx's
  // <BrowserRouter basename="/superadmin">. There is no dev server for this
  // app — `npm run dev` in backend/ runs `vite build --watch` (a compiler,
  // not a server) and the Express server serves whatever is on disk.
  base: '/superadmin/',
});
