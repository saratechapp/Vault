const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ownsAccount, foreignAccountField, decodeJwtIssuedAt } = require('../server');

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

// ---------------------------------------------------------------------------
// ownsAccount
// ---------------------------------------------------------------------------

test('ownsAccount returns true when id is falsy (no account specified)', () => {
  const userData = { accounts: [{ id: 'acc-1' }] };
  assert.equal(ownsAccount(userData, null), true);
  assert.equal(ownsAccount(userData, undefined), true);
  assert.equal(ownsAccount(userData, ''), true);
});

test('ownsAccount returns true when userData.accounts contains a matching id', () => {
  const userData = { accounts: [{ id: 'acc-1' }, { id: 'acc-2' }] };
  assert.equal(ownsAccount(userData, 'acc-1'), true);
  assert.equal(ownsAccount(userData, 'acc-2'), true);
});

test('ownsAccount returns false when no account matches the given id', () => {
  const userData = { accounts: [{ id: 'acc-1' }] };
  assert.equal(ownsAccount(userData, 'not-mine'), false);
});

test('ownsAccount returns false for an id belonging to another user (IDOR check)', () => {
  const userData = { accounts: [{ id: 'acc-1' }] };
  assert.equal(ownsAccount(userData, 'someone-elses-account-id'), false);
});

// ---------------------------------------------------------------------------
// foreignAccountField
// ---------------------------------------------------------------------------

test('foreignAccountField returns null when every referenced account is owned', () => {
  const userData = { accounts: [{ id: 'acc-1' }, { id: 'acc-2' }] };
  const body = { accountId: 'acc-1', fromAccountId: 'acc-2' };
  assert.equal(foreignAccountField(userData, body, ['accountId', 'fromAccountId']), null);
});

test('foreignAccountField returns null when the referenced fields are empty/absent', () => {
  const userData = { accounts: [{ id: 'acc-1' }] };
  assert.equal(foreignAccountField(userData, {}, ['accountId', 'fromAccountId']), null);
  assert.equal(foreignAccountField(userData, { accountId: '' }, ['accountId']), null);
  assert.equal(foreignAccountField(userData, { accountId: null }, ['accountId']), null);
});

test('foreignAccountField returns the name of the first field referencing an account the user does not own', () => {
  const userData = { accounts: [{ id: 'acc-1' }] };
  const body = { accountId: 'acc-1', toAccountId: 'not-mine' };
  assert.equal(foreignAccountField(userData, body, ['accountId', 'toAccountId']), 'toAccountId');
});

test('foreignAccountField checks fields in the given order and reports the first offending one', () => {
  const userData = { accounts: [{ id: 'acc-1' }] };
  const body = { fromAccountId: 'foreign-1', toAccountId: 'foreign-2' };
  assert.equal(foreignAccountField(userData, body, ['fromAccountId', 'toAccountId']), 'fromAccountId');
  assert.equal(foreignAccountField(userData, body, ['toAccountId', 'fromAccountId']), 'toAccountId');
});

test('foreignAccountField only checks the fields explicitly passed in', () => {
  const userData = { accounts: [{ id: 'acc-1' }] };
  const body = { accountId: 'acc-1', toAccountId: 'not-mine' };
  // toAccountId is foreign, but it isn't in the checked fields list.
  assert.equal(foreignAccountField(userData, body, ['accountId']), null);
});

// ---------------------------------------------------------------------------
// decodeJwtIssuedAt
// ---------------------------------------------------------------------------

test('decodeJwtIssuedAt converts the token\'s iat claim from seconds to milliseconds', () => {
  const iatSeconds = Math.floor(Date.now() / 1000);
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const payload = b64url({ iat: iatSeconds });
  const token = `${header}.${payload}.fakesig`;
  assert.equal(decodeJwtIssuedAt(token), iatSeconds * 1000);
});

test('decodeJwtIssuedAt returns null when the payload has no iat claim', () => {
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const payload = b64url({ sub: 'user-1' });
  const token = `${header}.${payload}.fakesig`;
  assert.equal(decodeJwtIssuedAt(token), null);
});

test('decodeJwtIssuedAt returns null (and does not throw) for malformed input', () => {
  assert.equal(decodeJwtIssuedAt('not-a-jwt'), null);
  assert.equal(decodeJwtIssuedAt(''), null);
  assert.equal(decodeJwtIssuedAt('a.b'), null); // only 2 segments, payload isn't valid base64url JSON
  assert.equal(decodeJwtIssuedAt('....'), null);
});

test('decodeJwtIssuedAt does not throw on non-string input', () => {
  assert.doesNotThrow(() => decodeJwtIssuedAt(null));
  assert.doesNotThrow(() => decodeJwtIssuedAt(undefined));
  assert.equal(decodeJwtIssuedAt(null), null);
  assert.equal(decodeJwtIssuedAt(undefined), null);
});
