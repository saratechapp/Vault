// Entrypoint. dotenv first (before anything requires supabaseClient, which
// throws on missing env), then build the app and — only when run directly
// (`node server.js` / `npm start` / nodemon) — bind a port. Being require()-
// able without listening keeps backend/__tests__/server.helpers.test.js
// working.
require('dotenv').config();
const { createApp } = require('./src/app');
const { PORT } = require('./src/config/env');

const app = createApp();

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Wallet backend running on http://localhost:${PORT}`);
  });
}

// Test-only surface: a handful of small pure helpers worth unit testing
// directly rather than only indirectly through route behavior. Kept here so
// backend/__tests__/server.helpers.test.js (`require('../server')`) needs no
// change; the implementations now live in src/lib.
const { ownsAccount, foreignAccountField } = require('./src/lib/ownership');
const { decodeJwtIssuedAt } = require('./src/lib/jwt');

module.exports = { ownsAccount, foreignAccountField, decodeJwtIssuedAt };
