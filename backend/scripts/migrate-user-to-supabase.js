// One-off migration: carries the single account for TARGET_EMAIL out of the
// legacy encrypted backend/sampledata.json into Supabase (Postgres + Auth).
// Every other account in sampledata.json (demo account, test accounts) is
// left untouched — not migrated, not deleted.
//
// Usage:
//   node backend/scripts/migrate-user-to-supabase.js --password=<new-login-password>
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env, and
// migration 0001_init.sql already applied to the project.
//
// The old scrypt password hash can't be ported to Supabase's auth format —
// this script sets a brand-new password you choose at run time (never
// hardcoded or committed). Does not modify or delete sampledata.json.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const dataCrypto = require('../src/crypto');
const { supabase } = require('../src/supabaseClient');

const TARGET_EMAIL = 'saravananmalikaraj@gmail.com';
const DATA_FILE = path.join(__dirname, '..', 'sampledata.json');

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
  }
  return args;
}

function loadLegacyDb() {
  const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  return dataCrypto.isEnvelope(raw) ? dataCrypto.decrypt(raw) : raw;
}

async function insertRows(table, rows) {
  if (rows.length === 0) return [];
  const { data, error } = await supabase.from(table).insert(rows).select();
  if (error) throw new Error(`insert into ${table} failed: ${error.message}`);
  return data;
}

async function main() {
  const args = parseArgs();
  const password = args.password || process.env.MIGRATION_PASSWORD;
  if (!password || password.length < 6) {
    console.error('Pass --password=<new-login-password> (6+ chars) — this becomes the login password for the migrated account.');
    process.exit(1);
  }

  const db = loadLegacyDb();
  const emailNorm = TARGET_EMAIL.toLowerCase();
  const legacyUser = db.users.find((u) => u.email.toLowerCase() === emailNorm);
  if (!legacyUser) {
    console.error(`No user with email ${TARGET_EMAIL} found in sampledata.json.`);
    process.exit(1);
  }
  const legacyData = db.userData[legacyUser.id] || {};
  const {
    categories = [], accounts = [], transactions = [], budgets = [], bills = [],
    goals = [], debts = [], templates = [], dashboardLayout = null,
  } = legacyData;

  console.log(`Found legacy user ${legacyUser.email} (${legacyUser.id}):`);
  console.log(`  ${categories.length} categories, ${accounts.length} accounts, ${transactions.length} transactions,`);
  console.log(`  ${budgets.length} budgets, ${bills.length} bills, ${goals.length} goals, ${debts.length} debts, ${templates.length} templates.`);

  // 1. Create the Supabase Auth user — or, if one already exists for this
  // email (e.g. from earlier testing), reuse it and (re)set its password,
  // so this script is safe to run more than once / after a prior partial run.
  let userId;
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: legacyUser.email,
    password,
    email_confirm: true,
    user_metadata: { name: legacyUser.name },
  });
  if (createErr) {
    const alreadyExists = /already.*registered|already exists|email_exists/i.test(createErr.message || '');
    if (!alreadyExists) throw new Error(`auth.admin.createUser failed: ${createErr.message}`);
    console.log(`Auth user for ${legacyUser.email} already exists — reusing it and resetting its password.`);
    let page = 1;
    let found = null;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data: listed, error: listErr } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      if (listErr) throw new Error(`auth.admin.listUsers failed: ${listErr.message}`);
      found = listed.users.find((u) => u.email?.toLowerCase() === emailNorm);
      if (found || listed.users.length < 200) break;
      page++;
    }
    if (!found) throw new Error(`Could not find the existing auth user for ${legacyUser.email} via listUsers.`);
    userId = found.id;
    const { error: updateErr } = await supabase.auth.admin.updateUserById(userId, {
      password, user_metadata: { name: legacyUser.name },
    });
    if (updateErr) throw new Error(`auth.admin.updateUserById failed: ${updateErr.message}`);
  } else {
    userId = created.user.id;
    console.log(`Created Supabase Auth user ${userId}.`);
  }

  // The signup trigger (0001_init.sql) creates a default profiles row +
  // default categories for every new auth user. Overwrite the profile with
  // the migrated values, and clear out any existing rows in every entity
  // table for this user (auto-seeded categories, or leftovers from a prior
  // partial run of this script) so re-running is always safe.
  const { error: profileErr } = await supabase
    .from('profiles')
    .update({
      name: legacyUser.name,
      phone: legacyUser.phone || '',
      avatar: legacyUser.avatar || '',
      currency: legacyUser.currency || 'INR',
      currency_symbol: legacyUser.currencySymbol || '₹',
      member_since: legacyUser.memberSince || null,
      plan: legacyUser.plan || 'Free',
      health_score: legacyUser.healthScore || 0,
      health_grade: legacyUser.healthGrade || '—',
      two_factor_enabled: !!legacyUser.twoFactorEnabled,
      biometric_enabled: !!legacyUser.biometricEnabled,
      dashboard_layout: dashboardLayout,
    })
    .eq('id', userId);
  if (profileErr) throw new Error(`profile update failed: ${profileErr.message}`);

  // Order matters: transactions/bills/budgets/etc. reference categories/accounts,
  // so clear the referencing tables first.
  const CLEAR_ORDER = ['notification_overlay', 'transactions', 'templates', 'debts', 'goals', 'bills', 'budgets', 'accounts', 'categories'];
  for (const table of CLEAR_ORDER) {
    const { error: wipeErr } = await supabase.from(table).delete().eq('user_id', userId);
    if (wipeErr) throw new Error(`clearing existing ${table} rows failed: ${wipeErr.message}`);
  }

  // 2. Categories — parents first, then children, tracking old id -> new id.
  const catIdMap = new Map();
  const parents = categories.filter((c) => !c.parentId);
  const children = categories.filter((c) => c.parentId);

  const insertedParents = await insertRows('categories', parents.map((c) => ({
    user_id: userId, name: c.name, icon: c.icon, color: c.color, parent_id: null,
  })));
  parents.forEach((c, i) => catIdMap.set(c.id, insertedParents[i].id));

  const insertedChildren = await insertRows('categories', children.map((c) => ({
    user_id: userId, name: c.name, icon: c.icon, color: c.color, parent_id: catIdMap.get(c.parentId) || null,
  })));
  children.forEach((c, i) => catIdMap.set(c.id, insertedChildren[i].id));
  console.log(`Migrated ${catIdMap.size} categories.`);

  // 3. Accounts.
  const acctIdMap = new Map();
  const insertedAccounts = await insertRows('accounts', accounts.map((a) => ({
    user_id: userId, name: a.name, type: a.type, opening_balance: a.openingBalance,
    color: a.color, icon: a.icon, currency: a.currency, institution: a.institution,
  })));
  accounts.forEach((a, i) => acctIdMap.set(a.id, insertedAccounts[i].id));
  console.log(`Migrated ${acctIdMap.size} accounts.`);

  const mapCat = (id) => (id ? catIdMap.get(id) || null : null);
  const mapAcct = (id) => (id ? acctIdMap.get(id) || null : null);

  // 4. Budgets.
  await insertRows('budgets', budgets.map((b) => ({
    user_id: userId, category_id: mapCat(b.categoryId), limit: b.limit, period: b.period,
    alert_at: b.alertAt, start_date: b.startDate || null, end_date: b.endDate || null,
  })));
  console.log(`Migrated ${budgets.length} budgets.`);

  // 5. Bills.
  const billIdMap = new Map();
  const insertedBills = await insertRows('bills', bills.map((b) => ({
    user_id: userId, name: b.name, type: b.type, amount: b.amount, due_date: b.dueDate,
    frequency: b.frequency, status: b.status, category: b.category, category_id: mapCat(b.categoryId),
    vendor: b.vendor, payment_method: b.paymentMethod, note: b.note, auto_post: !!b.autoPost,
    autopay: !!b.autopay, active: b.active !== false, last_run: b.lastRun || null,
    account_id: mapAcct(b.accountId), from_account_id: mapAcct(b.fromAccountId), to_account_id: mapAcct(b.toAccountId),
  })));
  bills.forEach((b, i) => billIdMap.set(b.id, insertedBills[i].id));
  console.log(`Migrated ${billIdMap.size} bills.`);

  // 6. Goals.
  await insertRows('goals', goals.map((g) => ({
    user_id: userId, name: g.name, icon: g.icon, target: g.target, saved: g.saved,
    deadline: g.deadline || null, priority: g.priority, color: g.color,
    monthly_contribution: g.monthlyContribution, note: g.note, account_id: mapAcct(g.accountId),
  })));
  console.log(`Migrated ${goals.length} goals.`);

  // 7. Debts.
  const debtIdMap = new Map();
  const insertedDebts = await insertRows('debts', debts.map((d) => ({
    user_id: userId, name: d.name, creditor: d.creditor, balance: d.balance,
    apr: d.apr, min_payment: d.minPayment, due_date: d.dueDate || null,
  })));
  debts.forEach((d, i) => debtIdMap.set(d.id, insertedDebts[i].id));
  console.log(`Migrated ${debtIdMap.size} debts.`);

  // 8. Templates.
  await insertRows('templates', templates.map((t) => ({
    user_id: userId, name: t.name, type: t.type, amount: t.amount, category_id: mapCat(t.categoryId),
    account_id: mapAcct(t.accountId), payment_method: t.paymentMethod, vendor: t.vendor, note: t.note,
  })));
  console.log(`Migrated ${templates.length} templates.`);

  // 9. Transactions — last, since they can reference categories/accounts/bills/debts.
  const mapBill = (id) => (id ? billIdMap.get(id) || null : null);
  const mapDebt = (id) => (id ? debtIdMap.get(id) || null : null);
  await insertRows('transactions', transactions.map((t) => ({
    user_id: userId, date: t.date, vendor: t.vendor, category_id: mapCat(t.categoryId), amount: t.amount,
    type: t.type, payment_method: t.paymentMethod, note: t.note, labels: t.labels || [],
    payer: t.payer, payment_status: t.paymentStatus, currency: t.currency,
    account_id: mapAcct(t.accountId), from_account_id: mapAcct(t.fromAccountId), to_account_id: mapAcct(t.toAccountId),
    source_bill_id: mapBill(t.sourceBillId), source_debt_id: mapDebt(t.sourceDebtId),
  })));
  console.log(`Migrated ${transactions.length} transactions.`);

  console.log('\nDone. Notification read/dismissed state was intentionally NOT migrated');
  console.log('(generated notification ids are derived from entity ids, which changed) —');
  console.log('everything will show as unread once, which is a one-time, harmless reset.');
  console.log(`\nLog in as ${legacyUser.email} with the password you passed to this script.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
