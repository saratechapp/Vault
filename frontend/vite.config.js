import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The admin app's base ('/superadmin/', see admin/vite.config.js) requires
// the trailing slash exactly — a bare /superadmin (no slash, e.g. someone
// bookmarks or types it by hand) trips Vite's own "did you mean X/?"
// warning page instead of loading the app. Redirect it before the proxy
// ever sees it, so both forms just work.
function redirectBareSuperadmin() {
  return {
    name: 'redirect-bare-superadmin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/superadmin') {
          res.writeHead(302, { Location: '/superadmin/' });
          res.end();
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), redirectBareSuperadmin()],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      // Dev-only convenience: forwards to the one backend server, which
      // serves the Super Admin SPA as static files under /superadmin (see
      // backend/src/app.js). Lets the Topbar's "Super Admin" button and a
      // bare localhost:5173/superadmin/ both work while running the consumer
      // app on its own port. In production everything is same-origin, so no
      // proxy is involved. There is no separate admin dev server.
      '/superadmin': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
