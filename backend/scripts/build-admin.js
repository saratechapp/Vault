// Build the Super Admin SPA (backend/admin) into backend/admin/dist, which
// server.js serves under /superadmin.
//
// Usage: npm run build   (from backend/)  — Render runs this at deploy time.
//
// The admin bundle needs two PUBLIC Supabase values inlined at build time:
// VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. There is no separate
// backend/admin/.env — this script sources them from the single backend
// config: process.env (already populated on Render / CI) with a fallback to
// backend/.env via dotenv for local builds. Vite picks up any VITE_*-prefixed
// var already present in process.env, so passing them through to the child
// process is enough — no file is written.

require('dotenv').config(); // loads backend/.env when present; no-op otherwise
const { execFileSync } = require('child_process');
const path = require('path');

const ADMIN_DIR = path.join(__dirname, '..', 'admin');
const REQUIRED = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];

const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(
    `\nbuild-admin: missing required env var(s): ${missing.join(', ')}\n\n` +
    `Set them in the deploy environment (e.g. Render) or in backend/.env for\n` +
    `local builds. They are the same public values as frontend/.env — the anon\n` +
    `key is safe to embed in the client bundle.\n`
  );
  process.exit(1);
}

const run = (args) => execFileSync('npm', args, { cwd: ADMIN_DIR, stdio: 'inherit', env: process.env });

console.log('build-admin: installing admin dependencies...');
run(['ci', '--include=dev']);
console.log('build-admin: building admin SPA -> backend/admin/dist ...');
run(['run', 'build']);
console.log('build-admin: done.');
