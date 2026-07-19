const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MODULES, isValidPair, catalog } = require('../adminPermissions');

const allPairs = Object.entries(MODULES).flatMap(([module, { actions }]) => actions.map((action) => [module, action]));

test('isValidPair returns true for every (module, action) pair declared in MODULES', () => {
  allPairs.forEach(([module, action]) => {
    assert.equal(isValidPair(module, action), true, `expected ${module}:${action} to be valid`);
  });
});

test('isValidPair returns false for a typo\'d action on a real module', () => {
  assert.equal(isValidPair('users', 'veiw'), false);
  assert.equal(isValidPair('feedback', 'deletee'), false);
});

test('isValidPair returns false for an unknown module', () => {
  assert.equal(isValidPair('billing', 'view'), false);
  assert.equal(isValidPair('', 'view'), false);
});

test('isValidPair returns false for a valid module paired with an action that belongs to a different module', () => {
  // 'impersonate' belongs to 'users', not 'dashboard' or 'auditLogs'.
  assert.equal(isValidPair('dashboard', 'impersonate'), false);
  assert.equal(isValidPair('auditLogs', 'impersonate'), false);
  // 'assign' belongs to 'feedback', not 'admins'.
  assert.equal(isValidPair('admins', 'assign'), false);
});

test('isValidPair returns false for undefined/null module or action', () => {
  assert.equal(isValidPair(undefined, 'view'), false);
  assert.equal(isValidPair('users', undefined), false);
  assert.equal(isValidPair(null, null), false);
});

test('catalog returns a flat array covering every declared (module, action) pair, with the correct length', () => {
  const result = catalog();
  const expectedLength = Object.values(MODULES).reduce((sum, { actions }) => sum + actions.length, 0);
  assert.equal(result.length, expectedLength);
  allPairs.forEach(([module, action]) => {
    assert.ok(result.some((entry) => entry.module === module && entry.action === action), `expected catalog to include ${module}:${action}`);
  });
});

test('catalog entries are shaped as plain { module, action } objects', () => {
  catalog().forEach((entry) => {
    assert.equal(typeof entry.module, 'string');
    assert.equal(typeof entry.action, 'string');
    assert.deepEqual(Object.keys(entry).sort(), ['action', 'module']);
  });
});

test('MODULES declares exactly the expected set of modules and actions', () => {
  assert.deepEqual(MODULES.dashboard.actions, ['view']);
  assert.deepEqual(MODULES.users.actions, ['view', 'edit', 'suspend', 'delete', 'impersonate', 'export']);
  assert.deepEqual(MODULES.admins.actions, ['view', 'create', 'edit', 'delete']);
  assert.deepEqual(MODULES.rbac.actions, ['view', 'edit']);
  assert.deepEqual(MODULES.feedback.actions, ['view', 'edit', 'assign', 'delete']);
  assert.deepEqual(MODULES.auditLogs.actions, ['view']);
});
