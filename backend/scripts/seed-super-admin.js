// One-off bootstrap: grants Super Admin access to an existing (or brand-new)
// account, so there's at least one way into the admin panel before any
// admin exists to invite others via POST /api/admin/admins.
//
// Usage:
//   node backend/scripts/seed-super-admin.js --email=you@example.com
//   node backend/scripts/seed-super-admin.js --email=you@example.com --set-password
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env, and
// migrations 0008_admin_panel_core.sql onward already applied to the
// project (the `admins`/`admin_roles` tables and the seeded "Super Admin"
// role row must exist).
//
// Without --set-password: if the email isn't already a Supabase Auth user,
// this invites them (same supabase.auth.admin.inviteUserByEmail flow
// POST /api/admin/admins uses) — they'll get an email to set a password. If
// they already have an account, it just adds the `admins` row on top;
// nothing about their existing login changes.
//
// With --set-password: generates a fresh random password and sets it
// directly on the account via the service-role API (no email round-trip) —
// prints it once, here, and nowhere else. Overwrites whatever password that
// account currently has, so only use this when you actually want that
// account's password reset right now.

require('dotenv').config();
const crypto = require('crypto');
const { supabase } = require('../src/supabaseClient');

function generatePassword() {
  // 18 chars from a symbol-inclusive alphabet — comfortably clears typical
  // password-strength requirements without being awkward to type once.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  return Array.from(crypto.randomBytes(18)).map((b) => alphabet[b % alphabet.length]).join('');
}

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const kv = arg.match(/^--([^=]+)=(.*)$/);
    if (kv) { args[kv[1]] = kv[2]; continue; }
    const flag = arg.match(/^--([^=]+)$/);
    if (flag) args[flag[1]] = true;
  }
  return args;
}

async function findOrInviteUser(email) {
  // supabase-js has no direct "get user by email" admin call — page through
  // listUsers(). Fine for a one-off script against a project that (at this
  // stage of the product) has a small user base.
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 200) break;
    page += 1;
  }
  const { data: invited, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(email);
  if (inviteErr) throw inviteErr;
  console.log(`No existing account for ${email} — invited them (check their inbox to set a password).`);
  return invited.user;
}

async function main() {
  const { email, 'set-password': setPassword } = parseArgs();
  if (!email) {
    console.error('Pass --email=<address> for the account to grant Super Admin access to.');
    process.exit(1);
  }

  const { data: role, error: roleErr } = await supabase
    .from('admin_roles').select('id, name').eq('name', 'Super Admin').maybeSingle();
  if (roleErr) throw roleErr;
  if (!role) {
    console.error("No 'Super Admin' role found — has migration 0008_admin_panel_core.sql been applied?");
    process.exit(1);
  }

  const user = await findOrInviteUser(email);

  const { error: upsertErr } = await supabase
    .from('admins')
    .upsert({ id: user.id, name: user.user_metadata?.name || '', role_id: role.id, status: 'active' }, { onConflict: 'id' });
  if (upsertErr) throw upsertErr;

  let generatedPassword = null;
  if (setPassword) {
    generatedPassword = generatePassword();
    const { error: pwErr } = await supabase.auth.admin.updateUserById(user.id, { password: generatedPassword });
    if (pwErr) throw pwErr;
  }

  console.log(`${email} is now a Super Admin.`);
  if (generatedPassword) {
    console.log('');
    console.log('  Temporary password (shown once — change it after logging in):');
    console.log(`  ${generatedPassword}`);
    console.log('');
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
