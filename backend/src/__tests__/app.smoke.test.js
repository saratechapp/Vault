// Dependency-free smoke test: boots the real app on an ephemeral port and
// checks the load-bearing edges of the middleware chain — that the router
// graph mounts, requireAuth rejects anonymous requests, the admin boundary
// is wired, and the 404 handler is last. Catches a broken require() path or
// a misordered handler that the pure-function unit tests can't see.
// Mirrors server.js: dotenv before anything pulls in supabaseClient (which
// throws on missing env). `node --test` runs each file in its own process,
// so this file must load .env itself.
require('dotenv').config();
const { test, after, before } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { createApp } = require('../app');

let server;
let base;

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server && server.close());

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`${base}${path}`, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

test('GET /api/health -> 200 ok', async () => {
  const res = await get('/api/health');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(JSON.parse(res.body).status, 'ok');
});

test('GET /api/me without auth -> 401', async () => {
  const res = await get('/api/me');
  assert.strictEqual(res.status, 401);
  assert.strictEqual(JSON.parse(res.body).error, 'unauthorized');
});

test('GET /api/admin/me without auth -> 401', async () => {
  const res = await get('/api/admin/me');
  assert.strictEqual(res.status, 401);
});

test('unknown path -> 404 not found', async () => {
  const res = await get('/definitely-not-a-route');
  assert.strictEqual(res.status, 404);
  assert.strictEqual(JSON.parse(res.body).error, 'not found');
});
