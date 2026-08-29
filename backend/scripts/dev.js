// `npm run dev` for the whole backend: the Express API (which also serves the
// Super Admin SPA at /superadmin) AND a Vite watcher that keeps
// backend/admin/dist fresh as you edit the admin source.
//
// There is only ONE server here — nodemon/Express. `vite build --watch` is a
// compiler that rewrites backend/admin/dist in place; it is not a dev server
// and binds no port. So the single command gives you:
//
//   API              http://localhost:<PORT>/api
//   Super Admin API  http://localhost:<PORT>/api/admin
//   Super Admin UI   http://localhost:<PORT>/superadmin/
//
// (Full page reload on admin edits, not HMR. If you want HMR while iterating
//  on the admin UI, `cd backend/admin && npm run dev` is still there as an
//  optional extra — it is never required.)

require('dotenv').config();
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BACKEND_DIR = path.join(__dirname, '..');
const ADMIN_DIR = path.join(BACKEND_DIR, 'admin');
const DIST_INDEX = path.join(ADMIN_DIR, 'dist', 'index.html');
const VITE_VARS = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];

const children = [];
let shuttingDown = false;

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    try { child.kill('SIGTERM'); } catch { /* already gone */ }
  }
  process.exit(code ?? 0);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

// Line-prefixed passthrough so the two streams don't interleave mid-line.
function pipePrefixed(child, tag) {
  for (const [stream, out] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
    if (!stream) continue;
    let buf = '';
    stream.on('data', (chunk) => {
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) out.write(`[${tag}] ${line}\n`);
    });
  }
}

// 1. First run in a fresh clone: make sure the admin app's deps are installed.
if (!fs.existsSync(path.join(ADMIN_DIR, 'node_modules'))) {
  console.log('[dev] installing Super Admin dependencies (first run only)...');
  const install = spawnSync('npm', ['install'], { cwd: ADMIN_DIR, stdio: 'inherit' });
  if (install.status !== 0) {
    console.error('[dev] `npm install` in backend/admin failed — fix that, then re-run.');
    process.exit(1);
  }
}

const haveViteVars = VITE_VARS.every((k) => process.env[k]);

if (!haveViteVars) {
  console.warn(
    `[dev] ${VITE_VARS.join(' / ')} not set (backend/.env) — starting the API only.\n` +
    '[dev] /superadmin will not be served until they are set and you re-run `npm run dev`.'
  );
} else {
  // 2. Guarantee dist exists before the server boots — src/app.js decides
  //    whether to mount /superadmin with a one-time fs.existsSync check.
  if (!fs.existsSync(DIST_INDEX)) {
    console.log('[dev] building Super Admin (first build)...');
    const build = spawnSync('npm', ['run', 'build'], { cwd: ADMIN_DIR, stdio: 'inherit', env: process.env });
    if (build.status !== 0) {
      console.error('[dev] initial Super Admin build failed.');
      process.exit(1);
    }
  }

  // 3. Keep dist fresh on every admin source edit (rebuild + browser refresh;
  //    Express serves whatever is currently on disk, so no server restart).
  const watcher = spawn('npm', ['run', 'build:watch'], { cwd: ADMIN_DIR, env: process.env });
  pipePrefixed(watcher, 'admin');
  watcher.on('exit', (code) => { if (!shuttingDown) shutdown(code ?? 0); });
  children.push(watcher);
}

// 4. The one server. nodemon watches server.js + src/ (see nodemonConfig);
//    it ignores admin/, so admin rebuilds never bounce the API.
const api = spawn('npm', ['run', 'dev:api'], { cwd: BACKEND_DIR, env: process.env });
pipePrefixed(api, 'api');
api.on('exit', (code) => { if (!shuttingDown) shutdown(code ?? 0); });
children.push(api);

const port = process.env.PORT || 4000;
process.stdout.write(
  `\n[dev] one command, one server:\n` +
  `[dev]   API            http://localhost:${port}/api\n` +
  `[dev]   Super Admin UI  http://localhost:${port}/superadmin/\n\n`
);
