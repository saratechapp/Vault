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
      // Dev-only convenience: forwards to the separate admin/ Vite app (see
      // admin/vite.config.js, which sets base: '/superadmin/' to match) so
      // there's one URL/port to remember instead of two. `ws: true` carries
      // the admin app's own HMR websocket through. In production this needs
      // a matching reverse-proxy rule — nothing here helps outside dev.
      '/superadmin': {
        target: 'http://localhost:5174',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
